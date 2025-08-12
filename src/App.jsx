// SISTEMA DE CONTROLE DE ATIVOS COM AUTENTICAÇÃO SEGURA E IMPORTAÇÃO EXCEL
// Substitua o conteúdo do arquivo src/App.jsx por este código:

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import * as XLSX from 'xlsx';

// =================== CONTEXT DE AUTENTICAÇÃO ===================
const AuthContext = createContext({});

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// =================== UTILITÁRIOS DE CRIPTOGRAFIA ===================
const CryptoUtils = {
  // Gerar hash da senha usando Web Crypto API
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  // Verificar se a senha corresponde ao hash
  async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }
};

// =================== SERVIÇOS REAIS DO BANCO COM SENHA ===================
const databaseService = {
  async getConnection() {
    try {
      if (!import.meta.env.VITE_DATABASE_URL) {
        throw new Error('VITE_DATABASE_URL não configurada');
      }
      
      const { neon } = await import('@neondatabase/serverless');
      return neon(import.meta.env.VITE_DATABASE_URL);
    } catch (error) {
      console.error('Erro ao conectar:', error);
      throw error;
    }
  },

  async testConnection() {
    try {
      const sql = await this.getConnection();
      const result = await sql`SELECT NOW() as current_time`;
      console.log('✅ Conexão com NeonDB estabelecida:', result[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com NeonDB:', error);
      return false;
    }
  },

  async initializeDatabase() {
    try {
      const sql = await this.getConnection();

      // Criar tabela de times
      await sql`
        CREATE TABLE IF NOT EXISTS teams (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Criar tabela de usuários com senha hash e foto
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          photo TEXT,
          team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Verificar se existe coluna password_hash (para migração)
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`;
        console.log('✅ Coluna password_hash adicionada/verificada');
      } catch (error) {
        console.log('ℹ️ Coluna password_hash já existe ou erro na migração:', error);
      }

      // Verificar se existe coluna team_id (para migração)
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`;
        console.log('✅ Coluna team_id adicionada/verificada na tabela users');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
      }

      // Criar tabela de andares
      await sql`
        CREATE TABLE IF NOT EXISTS floors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migração: adicionar team_id aos floors
      try {
        await sql`ALTER TABLE floors ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada/verificada na tabela floors');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
      }

      // Criar tabela de salas
      await sql`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE,
          team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Migração: adicionar team_id às rooms
      try {
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada/verificada na tabela rooms');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
      }

      // Criar tabela de ativos
      await sql`
        CREATE TABLE IF NOT EXISTS assets (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(100) NOT NULL,
          category VARCHAR(100),
          description TEXT,
          value DECIMAL(12,2),
          status VARCHAR(50) DEFAULT 'Ativo',
          floor_id INTEGER REFERENCES floors(id),
          room_id INTEGER REFERENCES rooms(id),
          photo TEXT,
          supplier VARCHAR(255),
          serial_number VARCHAR(255),
          team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(code, team_id)
        )
      `;

      // Migração: adicionar team_id aos assets
      try {
        await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada/verificada na tabela assets');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
      }

      // Criar times padrão se não existirem
      const existingTeams = await sql`SELECT COUNT(*) as count FROM teams`;
      if (parseInt(existingTeams[0].count) === 0) {
        console.log('🏢 Criando times padrão...');
        
        const defaultTeams = [
          { name: 'TI', description: 'Equipe de Tecnologia da Informação' },
          { name: 'Facilities', description: 'Equipe de Facilities e Infraestrutura' },
          { name: 'Administrativo', description: 'Equipe Administrativa e Financeira' },
          { name: 'Recursos Humanos', description: 'Equipe de Recursos Humanos' }
        ];

        for (const team of defaultTeams) {
          await sql`
            INSERT INTO teams (name, description)
            VALUES (${team.name}, ${team.description})
          `;
          console.log(`✅ Time "${team.name}" criado`);
        }
      }

      console.log('✅ Banco de dados inicializado com autenticação segura');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar banco:', error);
      return false;
    }
  },

  teams: {
    async getAll() {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT * FROM teams ORDER BY name`;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar times:', error);
        return { success: false, error: error.message };
      }
    },

    async create(teamData) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO teams (name, description)
          VALUES (${teamData.name}, ${teamData.description || null})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar time:', error);
        return { success: false, error: error.message };
      }
    }
  },

  users: {
    async create(userData) {
      try {
        const sql = await databaseService.getConnection();
        
        // Hash da senha antes de salvar
        const passwordHash = await CryptoUtils.hashPassword(userData.password);
        
        const result = await sql`
          INSERT INTO users (email, name, password_hash, company, photo, team_id)
          VALUES (
            ${userData.email}, 
            ${userData.name}, 
            ${passwordHash}, 
            ${userData.company || null}, 
            ${userData.photo || null},
            ${userData.team_id || null}
          )
          RETURNING id, email, name, company, photo, team_id, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        
        if (error.message.includes('unique')) {
          return { success: false, error: 'Este e-mail já está em uso' };
        }
        
        return { success: false, error: error.message };
      }
    },

    async authenticate(email, password) {
      try {
        const sql = await databaseService.getConnection();
        
        // Buscar usuário com senha hash e informações do time
        const result = await sql`
          SELECT u.id, u.email, u.name, u.password_hash, u.company, u.photo, u.team_id,
                 u.created_at, u.updated_at, t.name as team_name, t.description as team_description
          FROM users u
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE u.email = ${email} 
          LIMIT 1
        `;
        
        if (result.length === 0) {
          return { success: false, error: 'E-mail não encontrado' };
        }
        
        const user = result[0];
        
        // Verificar se a senha está correta
        const isValidPassword = await CryptoUtils.verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
          return { success: false, error: 'Senha incorreta' };
        }
        
        // Retornar usuário sem o hash da senha
        const { password_hash, ...userWithoutPassword } = user;
        return { success: true, data: userWithoutPassword };
        
      } catch (error) {
        console.error('Erro na autenticação:', error);
        return { success: false, error: 'Erro interno do servidor' };
      }
    },

    async findByEmail(email) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT u.id, u.email, u.name, u.company, u.photo, u.team_id,
                 u.created_at, u.updated_at, t.name as team_name, t.description as team_description
          FROM users u
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE u.email = ${email} 
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE users 
          SET name = ${updates.name}, 
              company = ${updates.company || null},
              photo = ${updates.photo || null},
              team_id = ${updates.team_id || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, email, name, company, photo, team_id, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async updatePassword(id, newPassword) {
      try {
        const sql = await databaseService.getConnection();
        
        // Hash da nova senha
        const passwordHash = await CryptoUtils.hashPassword(newPassword);
        
        const result = await sql`
          UPDATE users 
          SET password_hash = ${passwordHash},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, email, name, company, photo, created_at, updated_at
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        return { success: false, error: error.message };
      }
    }
  },

  floors: {
    async getAll(teamId) {
      try {
        const sql = await databaseService.getConnection();
        const floors = await sql`
          SELECT * FROM floors WHERE team_id = ${teamId} ORDER BY name
        `;
        
        for (let floor of floors) {
          const rooms = await sql`
            SELECT * FROM rooms WHERE floor_id = ${floor.id} ORDER BY name
          `;
          floor.rooms = rooms;
        }
        
        return { success: true, data: floors };
      } catch (error) {
        console.error('Erro ao buscar andares:', error);
        return { success: false, error: error.message };
      }
    },

    async create(floorData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO floors (name, description, team_id)
          VALUES (${floorData.name}, ${floorData.description || null}, ${teamId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE floors 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE floor_id = ${id} AND team_id = ${teamId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir o andar pois existem ativos vinculados a ele' 
          };
        }

        await sql`
          DELETE FROM floors WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async getByName(name, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM floors 
          WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) AND team_id = ${teamId}
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar andar por nome:', error);
        return { success: false, error: error.message };
      }
    }
  },

  rooms: {
    async create(roomData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO rooms (name, description, floor_id, team_id)
          VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${teamId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE rooms 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              floor_id = ${updates.floor_id},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE room_id = ${id} AND team_id = ${teamId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir a sala pois existem ativos vinculados a ela' 
          };
        }

        await sql`
          DELETE FROM rooms WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar sala:', error);
        return { success: false, error: error.message };
      }
    }
  },

  assets: {
    async getAll(teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM assets WHERE team_id = ${teamId} ORDER BY created_at DESC
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO assets (
            name, code, category, description, value, status, 
            floor_id, room_id, photo, supplier, serial_number, team_id
          )
          VALUES (
            ${assetData.name}, ${assetData.code}, ${assetData.category || null},
            ${assetData.description || null}, ${assetData.value || null}, ${assetData.status},
            ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
            ${assetData.supplier || null}, ${assetData.serial_number || null}, ${teamId}
          )
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async createBatch(assetsData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const results = [];
        const errors = [];

        for (let i = 0; i < assetsData.length; i++) {
          const assetData = assetsData[i];
          try {
            const result = await sql`
              INSERT INTO assets (
                name, code, category, description, value, status, 
                floor_id, room_id, photo, supplier, serial_number, team_id
              )
              VALUES (
                ${assetData.name}, ${assetData.code}, ${assetData.category || null},
                ${assetData.description || null}, ${assetData.value || null}, ${assetData.status || 'Ativo'},
                ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
                ${assetData.supplier || null}, ${assetData.serial_number || null}, ${teamId}
              )
              RETURNING *
            `;
            results.push(result[0]);
          } catch (error) {
            console.error(`Erro ao criar ativo ${i + 1}:`, error);
            errors.push({
              row: i + 1,
              asset: assetData,
              error: error.message
            });
          }
        }

        return { 
          success: true, 
          data: {
            created: results,
            errors: errors,
            totalProcessed: assetsData.length,
            successCount: results.length,
            errorCount: errors.length
          }
        };
      } catch (error) {
        console.error('Erro no batch de ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE assets 
          SET name = ${updates.name}, 
              code = ${updates.code},
              category = ${updates.category || null},
              description = ${updates.description || null},
              value = ${updates.value || null},
              status = ${updates.status},
              floor_id = ${updates.floor_id},
              room_id = ${updates.room_id || null},
              photo = ${updates.photo || null},
              supplier = ${updates.supplier || null},
              serial_number = ${updates.serial_number || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await databaseService.getConnection();
        await sql`
          DELETE FROM assets WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar ativo:', error);
        return { success: false, error: error.message };
      }
    }
  }
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // ============= FUNÇÃO PARA CRIAR ANDARES PADRÃO =============
  const createDefaultFloors = async (teamId) => {
    try {
      if (!teamId) {
        console.log('ℹ️ Usuário sem time definido, pulando criação de andares padrão');
        return;
      }

      console.log('🏢 Verificando andares padrão para time:', teamId);
      
      const existingFloors = await databaseService.floors.getAll(teamId);
      if (!existingFloors.success) {
        console.error('Erro ao buscar andares existentes');
        return;
      }

      const floorNames = existingFloors.data.map(floor => floor.name.toLowerCase());
      
      const defaultFloors = [
        {
          name: '5º Andar',
          description: 'Quinto andar - Administrativo e Financeiro'
        },
        {
          name: '11º Andar', 
          description: 'Décimo primeiro andar - Tecnologia e Inovação'
        },
        {
          name: '15º Andar',
          description: 'Décimo quinto andar - Diretoria Executiva'
        }
      ];

      for (const floorData of defaultFloors) {
        const floorExists = floorNames.some(name => 
          name.includes('5') && floorData.name.includes('5') ||
          name.includes('11') && floorData.name.includes('11') ||
          name.includes('15') && floorData.name.includes('15')
        );

        if (!floorExists) {
          console.log(`🏢 Criando andar padrão: ${floorData.name}`);
          const result = await databaseService.floors.create(floorData, teamId);
          
          if (result.success) {
            console.log(`✅ Andar "${floorData.name}" criado com sucesso`);
            await createDefaultRooms(result.data.id, teamId, floorData.name);
          } else {
            console.error(`❌ Erro ao criar andar "${floorData.name}":`, result.error);
          }
        } else {
          console.log(`ℹ️ Andar "${floorData.name}" já existe`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao criar andares padrão:', error);
    }
  };

  // ============= FUNÇÃO PARA CRIAR SALAS PADRÃO =============
  const createDefaultRooms = async (floorId, teamId, floorName) => {
    try {
      let defaultRooms = [];
      
      if (floorName.includes('5')) {
        defaultRooms = [
          { name: 'Sala de Reuniões 501', description: 'Sala de reuniões principal' },
          { name: 'Departamento Financeiro', description: 'Setor financeiro e contábil' },
          { name: 'Recursos Humanos', description: 'Departamento de RH' }
        ];
      } else if (floorName.includes('11')) {
        defaultRooms = [
          { name: 'Sala de Desenvolvimento', description: 'Equipe de desenvolvimento de software' },
          { name: 'Laboratório de Testes', description: 'Ambiente para testes e homologação' },
          { name: 'Sala de Inovação', description: 'Espaço para brainstorming e inovação' }
        ];
      } else if (floorName.includes('15')) {
        defaultRooms = [
          { name: 'Sala da Diretoria', description: 'Sala do conselho executivo' },
          { name: 'Sala de Reuniões Executiva', description: 'Reuniões de alta gestão' },
          { name: 'Secretaria Executiva', description: 'Suporte à diretoria' }
        ];
      }

      for (const roomData of defaultRooms) {
        const roomResult = await databaseService.rooms.create({
          ...roomData,
          floor_id: floorId
        }, teamId);
        
        if (roomResult.success) {
          console.log(`✅ Sala "${roomData.name}" criada no ${floorName}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao criar salas padrão:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const isConnected = await databaseService.testConnection();
        if (!isConnected) {
          setConnectionError('Falha na conexão com banco de dados NeonDB');
          setLoading(false);
          return;
        }

        const dbInit = await databaseService.initializeDatabase();
        if (!dbInit) {
          setConnectionError('Falha ao inicializar estrutura do banco');
          setLoading(false);
          return;
        }

        setDbReady(true);
        setConnectionError(null);

        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            const userCheck = await databaseService.users.findByEmail(userData.email);
            if (userCheck.success && userCheck.data) {
              setUser(userCheck.data);
              setProfile(userCheck.data);
              
              await createDefaultFloors(userCheck.data.team_id);
            } else {
              localStorage.removeItem('asset_manager_user');
            }
          } catch (error) {
            console.error('Erro ao validar usuário salvo:', error);
            localStorage.removeItem('asset_manager_user');
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        setConnectionError('Erro ao conectar com banco de dados');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const signUp = async (email, password, name, company = '', photo = null, team_id = null) => {
    if (!dbReady) {
      return { success: false, error: 'Banco de dados não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações básicas
      if (!email || !password || !name) {
        return { success: false, error: 'E-mail, senha e nome são obrigatórios' };
      }
      
      if (password.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }

      // Validação de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'E-mail inválido' };
      }
      
      const result = await databaseService.users.create({
        email,
        password,
        name,
        company,
        photo,
        team_id
      });

      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        await createDefaultFloors(userData.team_id);
        
        return { success: true, data: { user: userData } };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!dbReady) {
      return { success: false, error: 'Banco de dados não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações básicas
      if (!email || !password) {
        return { success: false, error: 'E-mail e senha são obrigatórios' };
      }
      
      const result = await databaseService.users.authenticate(email, password);
      
      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        await createDefaultFloors(userData.team_id);
        
        return { success: true, data: { user: userData } };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setUser(null);
      setProfile(null);
      localStorage.removeItem('asset_manager_user');
      return { success: true };
    } catch (error) {
      console.error('Erro no logout:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      const result = await databaseService.users.update(user.id, updates);
      
      if (result.success) {
        const updatedUser = result.data;
        setUser(updatedUser);
        setProfile(updatedUser);
        localStorage.setItem('asset_manager_user', JSON.stringify(updatedUser));
        
        return { success: true, data: updatedUser };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (newPassword) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      
      if (newPassword.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }
      
      const result = await databaseService.users.updatePassword(user.id, newPassword);
      
      if (result.success) {
        return { success: true, message: 'Senha alterada com sucesso' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    dbReady,
    connectionError,
    signUp,
    signIn,
    signOut,
    updateProfile,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =================== ÍCONES MODERNOS ===================
const Icons = {
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Package: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Camera: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  Download: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  BarChart3: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Trash2: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  DollarSign: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.5 1.5L5 6L3.5 4.5L5 3zM19 3l1.5 1.5L19 6l-1.5-1.5L19 3zM12 12l3-3 3 3-3 3-3-3zM5 21l1.5-1.5L5 18l-1.5 1.5L5 21zM19 21l1.5-1.5L19 18l-1.5 1.5L19 21z" />
    </svg>
  ),
  RotateCcw: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="1 4 1 10 7 10"></polyline>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  Key: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
};

// =================== COMPONENTE DE IMPORTAÇÃO EXCEL ===================
const ExcelImportModal = ({ 
  isOpen, 
  onClose, 
  onImport, 
  floors, 
  categories, 
  statuses,
  Icons 
}) => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [showMapping, setShowMapping] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const fileInputRef = useRef(null);

  const assetFields = [
    { key: 'name', label: 'Nome do Ativo', required: true },
    { key: 'code', label: 'Código', required: true },
    { key: 'category', label: 'Categoria', required: false },
    { key: 'description', label: 'Descrição', required: false },
    { key: 'value', label: 'Valor', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'floor_name', label: 'Nome do Andar', required: true },
    { key: 'room_name', label: 'Nome da Sala', required: false },
    { key: 'supplier', label: 'Fornecedor', required: false },
    { key: 'serial_number', label: 'Número de Série', required: false }
  ];

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
        alert('Por favor, selecione apenas arquivos Excel (.xlsx ou .xls)');
        return;
      }
      setFile(selectedFile);
      processExcelFile(selectedFile);
    }
  };

  const processExcelFile = async (file) => {
    setIsProcessing(true);
    setValidationErrors([]);
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converter para JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error('O arquivo deve conter pelo menos uma linha de cabeçalho e uma linha de dados');
      }

      const headers = jsonData[0].filter(header => header && header.toString().trim());
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      setExcelData({ headers, rows });
      
      // Inicializar mapeamento automático
      const autoMapping = {};
      headers.forEach((header, index) => {
        const headerLower = header.toString().toLowerCase().trim();
        
        // Mapeamento automático baseado em palavras-chave
        if (headerLower.includes('nome') || headerLower.includes('name')) {
          autoMapping[index] = 'name';
        } else if (headerLower.includes('código') || headerLower.includes('codigo') || headerLower.includes('code')) {
          autoMapping[index] = 'code';
        } else if (headerLower.includes('categoria') || headerLower.includes('category')) {
          autoMapping[index] = 'category';
        } else if (headerLower.includes('descrição') || headerLower.includes('descricao') || headerLower.includes('description')) {
          autoMapping[index] = 'description';
        } else if (headerLower.includes('valor') || headerLower.includes('value') || headerLower.includes('preço') || headerLower.includes('preco')) {
          autoMapping[index] = 'value';
        } else if (headerLower.includes('status')) {
          autoMapping[index] = 'status';
        } else if (headerLower.includes('andar') || headerLower.includes('floor')) {
          autoMapping[index] = 'floor_name';
        } else if (headerLower.includes('sala') || headerLower.includes('room')) {
          autoMapping[index] = 'room_name';
        } else if (headerLower.includes('fornecedor') || headerLower.includes('supplier')) {
          autoMapping[index] = 'supplier';
        } else if (headerLower.includes('série') || headerLower.includes('serie') || headerLower.includes('serial')) {
          autoMapping[index] = 'serial_number';
        }
      });

      setColumnMapping(autoMapping);
      setShowMapping(true);
      
      // Gerar preview dos dados
      generatePreview(rows, autoMapping, headers);
      
    } catch (error) {
      console.error('Erro ao processar arquivo Excel:', error);
      alert('Erro ao processar arquivo: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePreview = (rows, mapping, headers) => {
    const preview = rows.slice(0, 5).map((row, rowIndex) => {
      const mappedRow = {};
      Object.entries(mapping).forEach(([colIndex, fieldKey]) => {
        mappedRow[fieldKey] = row[parseInt(colIndex)] || '';
      });
      return { ...mappedRow, _originalRow: rowIndex };
    });
    setPreviewData(preview);
  };

  const validateData = (rows, mapping) => {
    const errors = [];
    const codes = new Set();

    rows.forEach((row, index) => {
      const rowNum = index + 2; // +2 porque começamos na linha 2 do Excel
      
      // Verificar campos obrigatórios
      const requiredFields = assetFields.filter(field => field.required);
      requiredFields.forEach(field => {
        const colIndex = Object.keys(mapping).find(key => mapping[key] === field.key);
        if (!colIndex || !row[parseInt(colIndex)] || !row[parseInt(colIndex)].toString().trim()) {
          errors.push(`Linha ${rowNum}: ${field.label} é obrigatório`);
        }
      });

      // Verificar código único
      const codeColIndex = Object.keys(mapping).find(key => mapping[key] === 'code');
      if (codeColIndex) {
        const code = row[parseInt(codeColIndex)]?.toString().trim();
        if (code) {
          if (codes.has(code)) {
            errors.push(`Linha ${rowNum}: Código "${code}" duplicado no arquivo`);
          } else {
            codes.add(code);
          }
        }
      }

      // Verificar valor se preenchido
      const valueColIndex = Object.keys(mapping).find(key => mapping[key] === 'value');
      if (valueColIndex && row[parseInt(valueColIndex)]) {
        const value = parseFloat(row[parseInt(valueColIndex)]);
        if (isNaN(value) || value < 0) {
          errors.push(`Linha ${rowNum}: Valor deve ser um número positivo`);
        }
      }

      // Verificar status se preenchido
      const statusColIndex = Object.keys(mapping).find(key => mapping[key] === 'status');
      if (statusColIndex && row[parseInt(statusColIndex)]) {
        const status = row[parseInt(statusColIndex)]?.toString().trim();
        if (status && !statuses.includes(status)) {
          errors.push(`Linha ${rowNum}: Status "${status}" inválido. Use: ${statuses.join(', ')}`);
        }
      }

      // Verificar categoria se preenchida
      const categoryColIndex = Object.keys(mapping).find(key => mapping[key] === 'category');
      if (categoryColIndex && row[parseInt(categoryColIndex)]) {
        const category = row[parseInt(categoryColIndex)]?.toString().trim();
        if (category && !categories.includes(category)) {
          errors.push(`Linha ${rowNum}: Categoria "${category}" não existe. Use: ${categories.join(', ')}`);
        }
      }
    });

    return errors;
  };

  const handleImport = async () => {
    if (!excelData || !columnMapping) return;

    setIsProcessing(true);
    
    try {
      // Validar dados
      const errors = validateData(excelData.rows, columnMapping);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setIsProcessing(false);
        return;
      }

      // Converter dados para formato de ativos
      const assetsToImport = [];
      
      for (const row of excelData.rows) {
        const asset = {
          name: '',
          code: '',
          category: '',
          description: '',
          value: null,
          status: 'Ativo',
          floor_id: null,
          room_id: null,
          supplier: '',
          serial_number: ''
        };

        // Mapear dados da linha
        Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
          const cellValue = row[parseInt(colIndex)];
          
          if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
            if (fieldKey === 'floor_name') {
              // Encontrar ID do andar pelo nome
              const floor = floors.find(f => 
                f.name.toLowerCase().includes(cellValue.toString().toLowerCase().trim()) ||
                cellValue.toString().toLowerCase().includes(f.name.toLowerCase())
              );
              if (floor) {
                asset.floor_id = floor.id;
              }
            } else if (fieldKey === 'room_name') {
              // Encontrar ID da sala pelo nome (será processado depois que tivermos o floor_id)
              asset._room_name = cellValue.toString().trim();
            } else if (fieldKey === 'value') {
              const numValue = parseFloat(cellValue);
              asset.value = isNaN(numValue) ? null : numValue;
            } else {
              asset[fieldKey] = cellValue.toString().trim();
            }
          }
        });

        // Buscar sala se especificada
        if (asset._room_name && asset.floor_id) {
          const floor = floors.find(f => f.id === asset.floor_id);
          if (floor && floor.rooms) {
            const room = floor.rooms.find(r => 
              r.name.toLowerCase().includes(asset._room_name.toLowerCase()) ||
              asset._room_name.toLowerCase().includes(r.name.toLowerCase())
            );
            if (room) {
              asset.room_id = room.id;
            }
          }
        }

        // Remover campo temporário
        delete asset._room_name;

        assetsToImport.push(asset);
      }

      // Chamar função de importação
      await onImport(assetsToImport);
      
      // Resetar estado
      handleClose();
      
    } catch (error) {
      console.error('Erro na importação:', error);
      alert('Erro na importação: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setExcelData(null);
    setColumnMapping({});
    setShowMapping(false);
    setValidationErrors([]);
    setPreviewData([]);
    setIsProcessing(false);
    onClose();
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Nome do Ativo', 'Código', 'Categoria', 'Descrição', 'Valor', 'Status', 'Andar', 'Sala', 'Fornecedor', 'Número de Série'],
      ['Notebook Dell', 'NB-001', 'Informática', 'Notebook para desenvolvimento', '2500.00', 'Ativo', '11º Andar', 'Sala de Desenvolvimento', 'Dell Brasil', 'DL240001'],
      ['Mesa de Escritório', 'MV-001', 'Móveis', 'Mesa executiva em L', '800.00', 'Ativo', '5º Andar', 'Departamento Financeiro', 'Móveis SA', ''],
      ['Impressora HP', 'IM-001', 'Equipamentos', 'Impressora multifuncional', '1200.00', 'Ativo', '15º Andar', 'Secretaria Executiva', 'HP Brasil', 'HP240001']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ativos');
    XLSX.writeFile(wb, 'template_ativos.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-gray-900 bg-clip-text text-transparent">
                📊 Importar Ativos do Excel
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                Faça upload de um arquivo Excel para cadastrar múltiplos ativos
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>

          {/* Etapa 1: Upload do arquivo */}
          {!showMapping && (
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-200">
                <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
                  <Icons.Upload />
                  <span className="ml-2">📁 Selecionar Arquivo Excel</span>
                </h4>
                
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-4 border-dashed border-blue-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 bg-gradient-to-br from-blue-50/50 to-cyan-50/50"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Icons.Upload />
                      </div>
                      <p className="text-blue-700 font-bold">
                        {file ? `📄 ${file.name}` : 'Clique para selecionar arquivo Excel'}
                      </p>
                      <p className="text-blue-600 text-sm">
                        Suporta .xlsx e .xls
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    onClick={downloadTemplate}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Icons.Download />
                    <span>📥 Baixar Template Excel</span>
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200">
                <h4 className="text-lg font-bold text-amber-900 mb-4">💡 Instruções</h4>
                <div className="space-y-3 text-amber-800">
                  <div className="flex items-start space-x-3">
                    <span className="font-bold text-amber-600">1.</span>
                    <p>Baixe o template Excel acima ou use seu próprio arquivo</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="font-bold text-amber-600">2.</span>
                    <p>Preencha as informações dos ativos (Nome e Código são obrigatórios)</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="font-bold text-amber-600">3.</span>
                    <p>Use os nomes exatos dos andares já cadastrados no sistema</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="font-bold text-amber-600">4.</span>
                    <p>Faça upload do arquivo e configure o mapeamento das colunas</p>
                  </div>
                </div>
              </div>

              {isProcessing && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-blue-600 font-bold">Processando arquivo Excel...</p>
                </div>
              )}
            </div>
          )}

          {/* Etapa 2: Mapeamento de colunas */}
          {showMapping && excelData && (
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-200">
                <h4 className="text-lg font-bold text-purple-900 mb-4 flex items-center">
                  <Icons.Package />
                  <span className="ml-2">🔗 Mapeamento de Colunas</span>
                </h4>
                <p className="text-purple-700 mb-6">
                  Configure como as colunas do Excel correspondem aos campos do sistema
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assetFields.map(field => (
                    <div key={field.key} className="space-y-2">
                      <label className="block text-sm font-bold text-purple-700">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={Object.keys(columnMapping).find(key => columnMapping[key] === field.key) || ''}
                        onChange={(e) => {
                          const newMapping = { ...columnMapping };
                          
                          // Remover mapeamento anterior desta coluna
                          Object.keys(newMapping).forEach(key => {
                            if (newMapping[key] === field.key) {
                              delete newMapping[key];
                            }
                          });
                          
                          // Adicionar novo mapeamento se selecionado
                          if (e.target.value !== '') {
                            newMapping[e.target.value] = field.key;
                          }
                          
                          setColumnMapping(newMapping);
                          generatePreview(excelData.rows, newMapping, excelData.headers);
                        }}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                      >
                        <option value="">Não mapear</option>
                        {excelData.headers.map((header, index) => (
                          <option key={index} value={index}>
                            Coluna {index + 1}: {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview dos dados */}
              {previewData.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
                  <h4 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                    <Icons.Eye />
                    <span className="ml-2">👀 Preview dos Dados (primeiras 5 linhas)</span>
                  </h4>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-100 border border-green-200">
                          <th className="p-2 text-left font-bold text-green-800">Nome</th>
                          <th className="p-2 text-left font-bold text-green-800">Código</th>
                          <th className="p-2 text-left font-bold text-green-800">Categoria</th>
                          <th className="p-2 text-left font-bold text-green-800">Valor</th>
                          <th className="p-2 text-left font-bold text-green-800">Status</th>
                          <th className="p-2 text-left font-bold text-green-800">Andar</th>
                          <th className="p-2 text-left font-bold text-green-800">Sala</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} className="bg-white border border-green-100 hover:bg-green-50">
                            <td className="p-2 font-medium">{row.name || '-'}</td>
                            <td className="p-2 font-mono text-xs">{row.code || '-'}</td>
                            <td className="p-2">{row.category || '-'}</td>
                            <td className="p-2">{row.value ? `R$ ${parseFloat(row.value).toLocaleString('pt-BR')}` : '-'}</td>
                            <td className="p-2">{row.status || 'Ativo'}</td>
                            <td className="p-2">{row.floor_name || '-'}</td>
                            <td className="p-2">{row.room_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Erros de validação */}
              {validationErrors.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-2xl border border-red-200">
                  <h4 className="text-lg font-bold text-red-900 mb-4 flex items-center">
                    <Icons.AlertCircle />
                    <span className="ml-2">❌ Erros de Validação ({validationErrors.length})</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="bg-white/80 p-3 rounded-lg border border-red-100">
                        <p className="text-red-800 text-sm font-medium">{error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowMapping(false);
                    setValidationErrors([]);
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
                >
                  ⬅️ Voltar
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    📊 {excelData.rows.length} linha(s) encontrada(s)
                  </p>
                  <p className="text-xs text-gray-500">
                    Campos obrigatórios: Nome, Código, Andar
                  </p>
                </div>

                <button
                  onClick={handleImport}
                  disabled={isProcessing || validationErrors.length > 0 || Object.keys(columnMapping).length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Importando...</span>
                    </div>
                  ) : (
                    '📥 Importar Ativos'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =================== MODAL DE RESULTADO DA IMPORTAÇÃO ===================
const ImportResultModal = ({ isOpen, onClose, result, Icons }) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                📈 Resultado da Importação
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                Resumo do processamento do arquivo Excel
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-200 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icons.FileText />
              </div>
              <p className="text-sm font-bold text-blue-700 mb-2">Total Processado</p>
              <p className="text-3xl font-bold text-blue-900">{result.totalProcessed}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icons.CheckCircle />
              </div>
              <p className="text-sm font-bold text-green-700 mb-2">Importados com Sucesso</p>
              <p className="text-3xl font-bold text-green-900">{result.successCount}</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-2xl border border-red-200 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icons.AlertCircle />
              </div>
              <p className="text-sm font-bold text-red-700 mb-2">Erros</p>
              <p className="text-3xl font-bold text-red-900">{result.errorCount}</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-2xl border border-red-200">
              <h4 className="text-lg font-bold text-red-900 mb-4 flex items-center">
                <Icons.AlertCircle />
                <span className="ml-2">❌ Erros Encontrados</span>
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-3">
                {result.errors.map((error, index) => (
                  <div key={index} className="bg-white/80 p-4 rounded-lg border border-red-100">
                    <p className="text-red-800 font-bold mb-2">Linha {error.row}:</p>
                    <p className="text-red-700 text-sm mb-2">{error.error}</p>
                    <p className="text-red-600 text-xs">
                      Ativo: {error.asset.name} ({error.asset.code})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.successCount > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
              <h4 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                <Icons.CheckCircle />
                <span className="ml-2">✅ Ativos Importados com Sucesso</span>
              </h4>
              <p className="text-green-700 font-medium">
                {result.successCount} ativo(s) foram cadastrados no sistema com sucesso!
              </p>
            </div>
          )}

          <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              ✅ Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================== UTILITÁRIOS PARA FOTOS ===================
const PhotoUtils = {
  // Converter file para base64
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Redimensionar imagem
  resizeImage: (file, maxWidth = 800, maxHeight = 600, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calcular novas dimensões mantendo proporção
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converter para base64
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.src = URL.createObjectURL(file);
    });
  },

  // Capturar foto da câmera
  captureFromCamera: () => {
    return new Promise((resolve, reject) => {
      // Verificar se o navegador suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error('Câmera não suportada neste navegador'));
        return;
      }

      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Câmera frontal
        } 
      })
        .then(stream => {
          // Criar elementos de vídeo e canvas
          const video = document.createElement('video');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          video.srcObject = stream;
          video.autoplay = true;
          video.muted = true;
          
          video.onloadedmetadata = () => {
            // Aguardar o vídeo carregar completamente
            setTimeout(() => {
              try {
                // Definir dimensões do canvas
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Capturar frame atual do vídeo
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Parar todos os tracks da stream
                stream.getTracks().forEach(track => {
                  track.stop();
                });
                
                // Converter para base64
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64);
              } catch (error) {
                // Parar stream em caso de erro
                stream.getTracks().forEach(track => track.stop());
                reject(new Error('Erro ao capturar foto: ' + error.message));
              }
            }, 500); // Aguardar 500ms para garantir que o vídeo esteja pronto
          };
          
          video.onerror = (error) => {
            stream.getTracks().forEach(track => track.stop());
            reject(new Error('Erro no vídeo: ' + error.message));
          };
        })
        .catch(error => {
          console.error('Erro ao acessar câmera:', error);
          reject(new Error('Não foi possível acessar a câmera. Verifique as permissões.'));
        });
    });
  }
};

// =================== MODAL DE AUTENTICAÇÃO ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  const [teams, setTeams] = useState([]);
  const { signIn, signUp, dbReady } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: '',
    team_id: ''
  });

  // Carregar times disponíveis
  useEffect(() => {
    const loadTeams = async () => {
      if (dbReady && !isLogin) {
        try {
          const result = await databaseService.teams.getAll();
          if (result.success) {
            setTeams(result.data);
          }
        } catch (error) {
          console.error('Erro ao carregar times:', error);
        }
      }
    };

    loadTeams();
  }, [dbReady, isLogin]);

  const handlePhotoCapture = async () => {
    try {
      const photo = await PhotoUtils.captureFromCamera();
      setUserPhoto(photo);
      setShowPhotoOptions(false);
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      setMessage('❌ Erro ao acessar câmera');
    }
  };

  const handlePhotoGallery = () => {
    fileInputRef.current?.click();
    setShowPhotoOptions(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const resizedPhoto = await PhotoUtils.resizeImage(file, 400, 400, 0.8);
        setUserPhoto(resizedPhoto);
      } catch (error) {
        console.error('Erro ao processar foto:', error);
        setMessage('❌ Erro ao processar foto');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!dbReady) {
      setMessage('❌ Banco de dados não está disponível');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let result;
      
      if (isLogin) {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.email, formData.password, formData.name, formData.company, userPhoto, formData.team_id);
      }

      if (result.success) {
        setMessage('✅ ' + (isLogin ? 'Login realizado!' : 'Conta criada!'));
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-purple-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 max-h-[95vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
          >
            <Icons.X />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Icons.User />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isLogin ? 'Acesse sua conta' : 'Crie sua conta com NeonDB'}
            </p>
            {!isLogin && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 font-medium">
                  🔐 Sua senha será criptografada com segurança
                </p>
              </div>
            )}
          </div>

          {!dbReady && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <p className="text-red-800 text-sm font-medium">
                ⚠️ Conexão com banco de dados necessária para login
              </p>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-lg mb-6 text-sm ${
              message.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="text-center mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    📷 Foto do Perfil (opcional)
                  </label>
                  
                  {userPhoto ? (
                    <div className="relative inline-block">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                        <img 
                          src={userPhoto} 
                          alt="Foto do usuário" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPhotoOptions(true)}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                      >
                        <Icons.Edit />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setShowPhotoOptions(true)}
                      className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto cursor-pointer hover:from-gray-300 hover:to-gray-400 transition-all border-4 border-dashed border-gray-400 hover:border-blue-400"
                    >
                      <Icons.Camera />
                    </div>
