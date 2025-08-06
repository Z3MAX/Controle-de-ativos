// SISTEMA DE CONTROLE DE ATIVOS COM AUTENTICAÇÃO SEGURA
// Substitua o conteúdo do arquivo src/App.jsx por este código:

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

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

      // Criar tabela de usuários com senha hash e foto
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          photo TEXT,
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

      // Criar tabela de andares
      await sql`
        CREATE TABLE IF NOT EXISTS floors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Criar tabela de salas
      await sql`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

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
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(code, user_id)
        )
      `;

      console.log('✅ Banco de dados inicializado com autenticação segura');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar banco:', error);
      return false;
    }
  },

  users: {
    async create(userData) {
      try {
        const sql = await databaseService.getConnection();
        
        // Hash da senha antes de salvar
        const passwordHash = await CryptoUtils.hashPassword(userData.password);
        
        const result = await sql`
          INSERT INTO users (email, name, password_hash, company, photo)
          VALUES (
            ${userData.email}, 
            ${userData.name}, 
            ${passwordHash}, 
            ${userData.company || null}, 
            ${userData.photo || null}
          )
          RETURNING id, email, name, company, photo, created_at, updated_at
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
        
        // Buscar usuário com senha hash
        const result = await sql`
          SELECT id, email, name, password_hash, company, photo, created_at, updated_at
          FROM users 
          WHERE email = ${email} 
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
          SELECT id, email, name, company, photo, created_at, updated_at
          FROM users 
          WHERE email = ${email} 
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
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, email, name, company, photo, created_at, updated_at
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
    async getAll(userId) {
      try {
        const sql = await databaseService.getConnection();
        const floors = await sql`
          SELECT * FROM floors WHERE user_id = ${userId} ORDER BY name
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

    async create(floorData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO floors (name, description, user_id)
          VALUES (${floorData.name}, ${floorData.description || null}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE floors 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE floor_id = ${id} AND user_id = ${userId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir o andar pois existem ativos vinculados a ele' 
          };
        }

        await sql`
          DELETE FROM floors WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async getByName(name, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM floors 
          WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) AND user_id = ${userId}
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
    async create(roomData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO rooms (name, description, floor_id, user_id)
          VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          UPDATE rooms 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              floor_id = ${updates.floor_id},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        
        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE room_id = ${id} AND user_id = ${userId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir a sala pois existem ativos vinculados a ela' 
          };
        }

        await sql`
          DELETE FROM rooms WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar sala:', error);
        return { success: false, error: error.message };
      }
    }
  },

  assets: {
    async getAll(userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM assets WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, userId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          INSERT INTO assets (
            name, code, category, description, value, status, 
            floor_id, room_id, photo, supplier, serial_number, user_id
          )
          VALUES (
            ${assetData.name}, ${assetData.code}, ${assetData.category || null},
            ${assetData.description || null}, ${assetData.value || null}, ${assetData.status},
            ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
            ${assetData.supplier || null}, ${assetData.serial_number || null}, ${userId}
          )
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
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
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await databaseService.getConnection();
        await sql`
          DELETE FROM assets WHERE id = ${id} AND user_id = ${userId}
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
  const createDefaultFloors = async (userId) => {
    try {
      console.log('🏢 Verificando andares padrão para usuário:', userId);
      
      const existingFloors = await databaseService.floors.getAll(userId);
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
          const result = await databaseService.floors.create(floorData, userId);
          
          if (result.success) {
            console.log(`✅ Andar "${floorData.name}" criado com sucesso`);
            await createDefaultRooms(result.data.id, userId, floorData.name);
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
  const createDefaultRooms = async (floorId, userId, floorName) => {
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
        }, userId);
        
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
              
              await createDefaultFloors(userCheck.data.id);
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

  const signUp = async (email, password, name, company = '', photo = null) => {
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
        photo
      });

      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        await createDefaultFloors(userData.id);
        
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
        
        await createDefaultFloors(userData.id);
        
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

// [RESTO DO CÓDIGO PERMANECE IGUAL - APENAS COPIANDO A PARTIR DOS ÍCONES...]
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
  )
};

// [RESTO DO CÓDIGO CONTINUA IGUAL...]
// Vou incluir apenas o modal de autenticação atualizado:

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  const { signIn, signUp, dbReady } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  const PhotoUtils = {
    fileToBase64: (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    },

    resizeImage: (file, maxWidth = 800, maxHeight = 600, quality = 0.8) => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
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
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        };
        
        img.src = URL.createObjectURL(file);
      });
    },

    captureFromCamera: () => {
      return new Promise((resolve, reject) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          reject(new Error('Câmera não suportada neste navegador'));
          return;
        }

        navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        })
          .then(stream => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            
            video.onloadedmetadata = () => {
              setTimeout(() => {
                try {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  stream.getTracks().forEach(track => {
                    track.stop();
                  });
                  
                  const base64 = canvas.toDataURL('image/jpeg', 0.8);
                  resolve(base64);
                } catch (error) {
                  stream.getTracks().forEach(track => track.stop());
                  reject(new Error('Erro ao capturar foto: ' + error.message));
                }
              }, 500);
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
        result = await signUp(formData.email, formData.password, formData.name, formData.company, userPhoto);
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
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    minLength="2"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome da empresa"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha *
              </label>
              <input
                type="password"
                required
                minLength="6"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <Icons.Key />
                <span className="ml-1">
                  {isLogin ? 'Digite sua senha' : 'Será criptografada com SHA-256'}
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !dbReady}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  {isLogin ? 'Entrando...' : 'Criando conta...'}
                </div>
              ) : (
                isLogin ? 'Entrar' : 'Criar Conta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage('');
                setUserPhoto(null);
                setFormData({ email: '', password: '', name: '', company: '' });
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de opções de foto */}
      {showPhotoOptions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">📷 Adicionar Foto</h3>
                  <p className="text-blue-100 text-sm mt-1">Escolha uma opção</p>
                </div>
                <button
                  onClick={() => setShowPhotoOptions(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <Icons.X />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <button
                onClick={handlePhotoCapture}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icons.Camera />
                </div>
                <div className="text-left">
                  <p className="font-bold">Tirar Foto</p>
                  <p className="text-sm text-emerald-100">Usar câmera do dispositivo</p>
                </div>
              </button>
              
              <button
                onClick={handlePhotoGallery}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Icons.Image />
                </div>
                <div className="text-left">
                  <p className="font-bold">Escolher da Galeria</p>
                  <p className="text-sm text-blue-100">Selecionar foto existente</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

// =================== MODAL DE OPÇÕES DE FOTO ===================
const PhotoOptionsModal = ({ isOpen, onClose, onCameraSelect, onGallerySelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">📷 Adicionar Foto</h3>
              <p className="text-blue-100 text-sm mt-1">Escolha uma opção</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <button
            onClick={onCameraSelect}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icons.Camera />
            </div>
            <div className="text-left">
              <p className="font-bold">Tirar Foto</p>
              <p className="text-sm text-emerald-100">Usar câmera do dispositivo</p>
            </div>
          </button>
          
          <button
            onClick={onGallerySelect}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white p-4 rounded-2xl flex items-center space-x-3 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icons.Image />
            </div>
            <div className="text-left">
              <p className="font-bold">Escolher da Galeria</p>
              <p className="text-sm text-blue-100">Selecionar foto existente</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE DE BADGE DE STATUS ===================
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'Ativo': { bg: 'from-green-100 to-emerald-100', text: 'text-green-800', border: 'border-green-200', icon: '✅' },
    'Inativo': { bg: 'from-gray-100 to-slate-100', text: 'text-gray-800', border: 'border-gray-200', icon: '⏸️' },
    'Manutenção': { bg: 'from-yellow-100 to-orange-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: '🔧' },
    'Descartado': { bg: 'from-red-100 to-pink-100', text: 'text-red-800', border: 'border-red-200', icon: '🗑️' }
  };

  const config = statusConfig[status] || statusConfig['Ativo'];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${config.bg} ${config.text} border ${config.border}`}>
      <span className="mr-1">{config.icon}</span>
      {status}
    </span>
  );
};

// =================== PÁGINA DE PERFIL ===================
const ProfilePage = () => {
  const { user, updateProfile, changePassword, loading: authLoading } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    company: user?.company || '',
    photo: user?.photo || null
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  // Sincronizar formData com dados do usuário
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        company: user.company || '',
        photo: user.photo || null
      });
    }
  }, [user]);

  const handlePhotoCapture = async () => {
    try {
      const photo = await PhotoUtils.captureFromCamera();
      console.log('Foto capturada, tamanho:', photo.length);
      setFormData(prev => ({ ...prev, photo }));
      setShowPhotoOptions(false);
      setMessage('✅ Foto capturada com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      setMessage('❌ Erro ao acessar câmera: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
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
        console.log('Arquivo selecionado:', file.name, 'Tamanho:', file.size);
        const resizedPhoto = await PhotoUtils.resizeImage(file, 400, 400, 0.8);
        console.log('Foto redimensionada, tamanho:', resizedPhoto.length);
        setFormData(prev => ({ ...prev, photo: resizedPhoto }));
        setMessage('✅ Foto selecionada com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erro ao processar foto:', error);
        setMessage('❌ Erro ao processar foto: ' + error.message);
        setTimeout(() => setMessage(''), 5000);
      }
    }
  };

  const handleSave = async () => {
    try {
      setLocalLoading(true);
      
      console.log('Dados a serem salvos:', formData);
      
      const result = await updateProfile(formData);
      if (result.success) {
        setMessage('✅ Perfil atualizado com sucesso!');
        setEditMode(false);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ ' + result.error);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage('❌ Erro ao atualizar perfil: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setLocalLoading(true);
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setMessage('❌ As senhas não coincidem');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      if (passwordData.newPassword.length < 6) {
        setMessage('❌ A senha deve ter pelo menos 6 caracteres');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      const result = await changePassword(passwordData.newPassword);
      if (result.success) {
        setMessage('✅ Senha alterada com sucesso!');
        setShowChangePassword(false);
        setPasswordData({ newPassword: '', confirmPassword: '' });
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ ' + result.error);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setMessage('❌ Erro ao alterar senha: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Header do Perfil */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white/20">
                    {(editMode ? formData.photo : user?.photo) ? (
                      <img 
                        src={editMode ? formData.photo : user.photo} 
                        alt="Foto do perfil" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/30 to-white/10">
                        <Icons.User />
                      </div>
                    )}
                  </div>
                  
                  {editMode && (
                    <button
                      onClick={() => setShowPhotoOptions(true)}
                      className="absolute -bottom-2 -right-2 w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
                    >
                      <Icons.Camera />
                    </button>
                  )}
                </div>
                
                <div className="text-center md:text-left flex-1">
                  <h1 className="text-3xl font-bold mb-2">{user?.name}</h1>
                  <p className="text-blue-100 text-lg mb-1">{user?.email}</p>
                  {user?.company && (
                    <p className="text-blue-200 font-medium">{user.company}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      👤 Usuário Ativo
                    </span>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      📅 Desde {new Date(user?.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="px-3 py-1 bg-green-400/20 rounded-full text-sm font-medium">
                      🔒 Login Seguro
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  {!editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium"
                      >
                        <Icons.Edit />
                        <span>Editar Perfil</span>
                      </button>
                      <button
                        onClick={() => setShowChangePassword(true)}
                        className="bg-green-500/20 hover:bg-green-500/30 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium"
                      >
                        <Icons.Key />
                        <span>Alterar Senha</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setFormData({
                            name: user?.name || '',
                            company: user?.company || '',
                            photo: user?.photo || null
                          });
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={localLoading || authLoading}
                        className="bg-white text-blue-600 hover:bg-gray-50 px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-medium disabled:opacity-50"
                      >
                        {localLoading || authLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Icons.Check />
                            <span>Salvar</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo do Perfil */}
          <div className="p-8">
            {message && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${
                message.includes('✅') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            {editMode ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                    placeholder="Seu nome completo"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Empresa</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                    placeholder="Nome da empresa (opcional)"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
                    <Icons.User />
                    <span className="ml-2">Informações Pessoais</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-blue-700">Nome:</label>
                      <p className="text-blue-900 font-bold">{user?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-blue-700">E-mail:</label>
                      <p className="text-blue-900 font-mono">{user?.email}</p>
                    </div>
                    {user?.company && (
                      <div>
                        <label className="text-sm font-medium text-blue-700">Empresa:</label>
                        <p className="text-blue-900 font-bold">{user.company}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
                  <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                    <Icons.Settings />
                    <span className="ml-2">Informações da Conta</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-green-700">Criada em:</label>
                      <p className="text-green-900 font-bold">
                        {new Date(user?.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Última atualização:</label>
                      <p className="text-green-900 font-bold">
                        {new Date(user?.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Status:</label>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                        ✅ Ativo
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-green-700">Segurança:</label>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                        🔒 SHA-256
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alteração de Senha */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Icons.Key />
                    <span className="ml-2">🔒 Alterar Senha</span>
                  </h3>
                  <p className="text-gray-600 mt-2">Digite sua nova senha</p>
                </div>
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nova Senha</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                    minLength="6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite novamente"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    🔐 A nova senha será criptografada com SHA-256
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={localLoading || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {localLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      <span>Alterando...</span>
                    </div>
                  ) : (
                    '🔒 Alterar Senha'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <PhotoOptionsModal
        isOpen={showPhotoOptions}
        onClose={() => setShowPhotoOptions(false)}
        onCameraSelect={handlePhotoCapture}
        onGallerySelect={handlePhotoGallery}
      />
    </>
  );
};

// =================== SISTEMA DE CONTROLE DE ATIVOS PRINCIPAL ===================
const AssetControlSystem = () => {
  const { user, profile, signOut } = useAuth();
  // Inicializar com dashboard por padrão (sem perfil)
  const [activeTab, setActiveTab] = useState('dashboard');
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingFloor, setEditingFloor] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const fileInputRef = useRef(null);

  const [assetForm, setAssetForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    value: '',
    status: 'Ativo',
    floor_id: '',
    room_id: '',
    photo: null,
    supplier: '',
    serial_number: ''
  });

  const [roomForm, setRoomForm] = useState({
    name: '',
    description: '',
    floor_id: ''
  });

  const [floorForm, setFloorForm] = useState({
    name: '',
    description: ''
  });

  const categories = [
    'Informática', 'Móveis', 'Equipamentos', 'Veículos', 'Ferramentas',
    'Eletrônicos', 'Eletrodomésticos', 'Máquinas', 'Instrumentos'
  ];

  const statuses = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'];

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [floorsResult, assetsResult] = await Promise.all([
        databaseService.floors.getAll(user.id),
        databaseService.assets.getAll(user.id)
      ]);

      if (floorsResult.success) {
        setFloors(floorsResult.data || []);
      }

      if (assetsResult.success) {
        setAssets(assetsResult.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetAssetForm = () => {
    setAssetForm({
      name: '',
      code: '',
      category: '',
      description: '',
      value: '',
      status: 'Ativo',
      floor_id: '',
      room_id: '',
      photo: null,
      supplier: '',
      serial_number: ''
    });
  };

  const handleEditAsset = (asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      code: asset.code,
      category: asset.category || '',
      description: asset.description || '',
      value: asset.value || '',
      status: asset.status,
      floor_id: asset.floor_id,
      room_id: asset.room_id || '',
      photo: asset.photo || null,
      supplier: asset.supplier || '',
      serial_number: asset.serial_number || ''
    });
    setShowAssetForm(true);
  };

  const handleSaveAsset = async () => {
    if (!assetForm.name || !assetForm.code || !assetForm.floor_id) {
      alert('Nome, código e andar são obrigatórios');
      return;
    }

    try {
      setIsLoading(true);
      let result;

      if (editingAsset) {
        result = await databaseService.assets.update(editingAsset.id, assetForm, user.id);
      } else {
        result = await databaseService.assets.create(assetForm, user.id);
      }
      
      if (result.success) {
        await loadData();
        resetAssetForm();
        setShowAssetForm(false);
        setEditingAsset(null);
      } else {
        alert('Erro ao salvar ativo: ' + result.error);
      }
    } catch (error) {
      alert('Erro ao salvar ativo: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAsset = async (asset) => {
    if (confirm(`Tem certeza que deseja excluir o ativo "${asset.name}"?`)) {
      try {
        setIsLoading(true);
        const result = await databaseService.assets.delete(asset.id, user.id);
        
        if (result.success) {
          await loadData();
        } else {
          alert('Erro ao excluir ativo: ' + result.error);
        }
      } catch (error) {
        alert('Erro ao excluir ativo: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name || !roomForm.floor_id) {
      alert('Nome e andar são obrigatórios');
      return;
    }

    try {
      setIsLoading(true);
      const result = await databaseService.rooms.create(roomForm, user.id);
      
      if (result.success) {
        await loadData();
        setRoomForm({ name: '', description: '', floor_id: '' });
        setShowRoomForm(false);
      } else {
        alert('Erro ao criar sala: ' + result.error);
      }
    } catch (error) {
      alert('Erro ao criar sala: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFloor = async () => {
    if (!floorForm.name) {
      alert('Nome do andar é obrigatório');
      return;
    }

    try {
      setIsLoading(true);
      const result = await databaseService.floors.create(floorForm, user.id);
      
      if (result.success) {
        await loadData();
        setFloorForm({ name: '', description: '' });
        setShowFloorForm(false);
      } else {
        alert('Erro ao criar andar: ' + result.error);
      }
    } catch (error) {
      alert('Erro ao criar andar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoCapture = async () => {
    try {
      const photo = await PhotoUtils.captureFromCamera();
      setAssetForm({ ...assetForm, photo });
      setShowPhotoOptions(false);
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      alert('Erro ao acessar câmera');
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
        const resizedPhoto = await PhotoUtils.resizeImage(file, 800, 600, 0.8);
        setAssetForm({ ...assetForm, photo: resizedPhoto });
      } catch (error) {
        console.error('Erro ao processar foto:', error);
        alert('Erro ao processar foto');
      }
    }
  };

  const removePhotoFromForm = () => {
    setAssetForm({ ...assetForm, photo: null });
  };

  const openPhotoOptions = () => {
    setShowPhotoOptions(true);
  };

  const getRoomsForFloor = (floorId) => {
    const floor = floors.find(f => f.id == floorId);
    return floor ? floor.rooms || [] : [];
  };

  const getFloorName = (floorId) => {
    const floor = floors.find(f => f.id == floorId);
    return floor ? floor.name : 'Andar não encontrado';
  };

  const getRoomName = (roomId) => {
    for (const floor of floors) {
      const room = floor.rooms?.find(r => r.id == roomId);
      if (room) return room.name;
    }
    return 'Sala não encontrada';
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      await signOut();
    }
  };

  const getDashboardStats = () => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'Ativo').length;
    const maintenance = assets.filter(a => a.status === 'Manutenção').length;
    const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.value) || 0), 0);

    return { total, active, maintenance, totalValue };
  };

  const getFilteredAssets = () => {
    return assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           asset.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filterStatus || asset.status === filterStatus;
      const matchesCategory = !filterCategory || asset.category === filterCategory;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  };

  const stats = getDashboardStats();
  const filteredAssets = getFilteredAssets();

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        {/* Header Moderno */}
        <div className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icons.Package />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                    AssetManager Pro
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">Sistema Inteligente de Controle de Ativos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="group flex items-center space-x-3 hover:bg-white/10 rounded-xl p-2 transition-all"
                >
                  {profile?.photo ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-gradient-to-r from-blue-500 to-purple-500 shadow-lg ring-2 ring-white group-hover:ring-blue-200 transition-all">
                      <img src={profile.photo} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white group-hover:ring-blue-200 transition-all">
                      <Icons.User />
                    </div>
                  )}
                  
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{profile?.name}</p>
                    <p className="text-xs text-gray-500">{profile?.email}</p>
                    {profile?.company && (
                      <p className="text-xs text-blue-600 font-medium">{profile.company}</p>
                    )}
                  </div>
                </button>
                
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navegação Moderna */}
        <div className="bg-white/60 backdrop-blur-lg border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Icons.BarChart3, gradient: 'from-blue-500 to-cyan-500' },
                { id: 'assets', label: 'Ativos', icon: Icons.Package, gradient: 'from-purple-500 to-pink-500' },
                { id: 'locations', label: 'Localizações', icon: Icons.Building, gradient: 'from-green-500 to-emerald-500' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 font-bold transition-all duration-200 relative ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {activeTab === tab.id && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-xl shadow-lg`}></div>
                  )}
                  <div className="relative z-10 flex items-center space-x-2">
                    <tab.icon />
                    <span>{tab.label}</span>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Perfil só aparece quando clicado */}
          {activeTab === 'profile' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-bold transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Voltar ao Dashboard</span>
                  </button>
                </div>
                
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                  👤 Perfil do Usuário
                </div>
              </div>
              
              <ProfilePage />
            </div>
          )}
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
                  Dashboard Executivo
                </h2>
                <p className="text-gray-600 text-lg font-medium">Visão completa dos seus ativos empresariais</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Package />
                    </div>
                    <div className="ml-6">
                      <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Total de Ativos</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        {stats.total}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.CheckCircle />
                    </div>
                    <div className="ml-6">
                      <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Ativos Ativos</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        {stats.active}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">🔧</span>
                    </div>
                    <div className="ml-6">
                      <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Em Manutenção</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                        {stats.maintenance}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all transform hover:scale-105">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.DollarSign />
                    </div>
                    <div className="ml-6">
                      <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Valor Total</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        R$ {stats.totalValue.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Status dos Ativos */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Distribuição por Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {statuses.map(status => {
                    const count = assets.filter(a => a.status === status).length;
                    const percentage = assets.length > 0 ? (count / assets.length * 100).toFixed(1) : 0;
                    
                    return (
                      <div key={status} className="text-center p-4">
                        <StatusBadge status={status} />
                        <p className="text-2xl font-bold text-gray-900 mt-3">{count}</p>
                        <p className="text-sm text-gray-600">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent mb-2">
                    Gestão de Ativos
                  </h2>
                  <p className="text-gray-600 text-lg font-medium">Controle completo dos seus equipamentos e bens</p>
                </div>
                
                <button
                  onClick={() => setShowAssetForm(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                >
                  <Icons.Plus />
                  <span>➕ Novo Ativo</span>
                </button>
              </div>

              {/* Filtros Modernos */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🔍 Filtros e Busca</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Buscar por nome ou código</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Digite para buscar..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Filtrar por status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">Todos os status</option>
                      {statuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Filtrar por categoria</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-gray-600 text-lg font-medium">Carregando ativos...</p>
                </div>
              ) : (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="text-xl font-bold text-gray-900">
                      📦 Seus Ativos ({filteredAssets.length} de {assets.length})
                    </h3>
                  </div>
                  
                  {filteredAssets.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Icons.Package />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {assets.length === 0 ? 'Nenhum ativo cadastrado' : 'Nenhum ativo encontrado'}
                      </h3>
                      <p className="text-gray-600 mb-8">
                        {assets.length === 0 
                          ? 'Comece criando seu primeiro ativo no sistema' 
                          : 'Tente ajustar os filtros de busca'
                        }
                      </p>
                      {assets.length === 0 && (
                        <button
                          onClick={() => setShowAssetForm(true)}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                        >
                          ➕ Criar Primeiro Ativo
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-8">
                      {filteredAssets.map(asset => (
                        <div key={asset.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all transform hover:scale-105">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h4 className="font-bold text-lg text-gray-900 mb-1">{asset.name}</h4>
                              <p className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded-lg inline-block">
                                {asset.code}
                              </p>
                            </div>
                            
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setShowAssetDetail(asset)}
                                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors"
                                title="Ver detalhes"
                              >
                                <Icons.Eye />
                              </button>
                              <button
                                onClick={() => handleEditAsset(asset)}
                                className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-xl transition-colors"
                                title="Editar"
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(asset)}
                                className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors"
                                title="Excluir"
                              >
                                <Icons.Trash2 />
                              </button>
                            </div>
                          </div>

                          {asset.photo && (
                            <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden mb-4">
                              <img 
                                src={asset.photo} 
                                alt={asset.name} 
                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                              />
                            </div>
                          )}

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">Status:</span>
                              <StatusBadge status={asset.status} />
                            </div>
                            
                            {asset.category && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">Categoria:</span>
                                <span className="text-sm font-bold text-gray-900">{asset.category}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">Local:</span>
                              <span className="text-sm font-bold text-gray-900">
                                {getFloorName(asset.floor_id)}
                                {asset.room_id && ` - ${getRoomName(asset.room_id)}`}
                              </span>
                            </div>
                            
                            {asset.value && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">Valor:</span>
                                <span className="text-sm font-bold text-green-600">
                                  R$ {parseFloat(asset.value).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2
                                  })}
                                </span>
                              </div>
                            )}
                            
                            <div className="pt-2 border-t border-gray-100">
                              <span className="text-xs text-gray-500">
                                Criado em {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-gray-900 bg-clip-text text-transparent mb-2">
                    Localizações
                  </h2>
                  <p className="text-gray-600 text-lg font-medium">Organize andares e salas da sua empresa</p>
                </div>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowFloorForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <Icons.Plus />
                    <span>🏢 Adicionar Andar</span>
                  </button>
                  
                  <button
                    onClick={() => setShowRoomForm(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <Icons.Plus />
                    <span>🚪 Nova Sala</span>
                  </button>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <Icons.Building />
                  <span className="ml-3">🏢 Andares ({floors.length})</span>
                </h3>
                
                {floors.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Icons.Building />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Carregando andares padrão...</h4>
                    <p className="text-gray-600 mb-8">Os andares 5º, 11º e 15º serão criados automaticamente</p>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {floors.map(floor => {
                      const isDefaultFloor = ['5', '11', '15'].some(num => floor.name.includes(num));
                      
                      return (
                        <div key={floor.id} className={`${
                          isDefaultFloor 
                            ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200' 
                            : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                        } border rounded-2xl p-6 hover:shadow-lg transition-all relative`}>
                          {isDefaultFloor && (
                            <div className="absolute top-2 right-2">
                              <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                ⭐ Padrão
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-start justify-between mb-4">
                            <div className="pr-16">
                              <h4 className={`text-lg font-bold ${
                                isDefaultFloor ? 'text-blue-900' : 'text-green-900'
                              }`}>
                                {floor.name}
                              </h4>
                              {floor.description && (
                                <p className={`text-sm mt-1 ${
                                  isDefaultFloor ? 'text-blue-700' : 'text-green-700'
                                }`}>
                                  {floor.description}
                                </p>
                              )}
                            </div>
                            <span className={`${
                              isDefaultFloor 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            } px-3 py-1 rounded-full text-xs font-bold`}>
                              {floor.rooms?.length || 0} sala(s)
                            </span>
                          </div>
                          
                          {floor.rooms && floor.rooms.length > 0 && (
                            <div className="space-y-2">
                              <h5 className={`text-sm font-bold mb-2 ${
                                isDefaultFloor ? 'text-blue-800' : 'text-green-800'
                              }`}>
                                🚪 Salas:
                              </h5>
                              {floor.rooms.map(room => (
                                <div key={room.id} className={`bg-white/80 rounded-lg p-3 border ${
                                  isDefaultFloor ? 'border-blue-100' : 'border-green-100'
                                } relative group`}>
                                  <div className="pr-12">
                                    <p className={`font-medium ${
                                      isDefaultFloor ? 'text-blue-900' : 'text-green-900'
                                    }`}>
                                      {room.name}
                                    </p>
                                    {room.description && (
                                      <p className={`text-xs mt-1 ${
                                        isDefaultFloor ? 'text-blue-600' : 'text-green-600'
                                      }`}>
                                        {room.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input para upload de fotos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Modal de Opções de Foto */}
      <PhotoOptionsModal
        isOpen={showPhotoOptions}
        onClose={() => setShowPhotoOptions(false)}
        onCameraSelect={handlePhotoCapture}
        onGallerySelect={handlePhotoGallery}
      />

      {/* Modal de Ativo */}
      {showAssetForm && (
        <AssetFormModal 
          showAssetForm={showAssetForm}
          setShowAssetForm={setShowAssetForm}
          editingAsset={editingAsset}
          setEditingAsset={setEditingAsset}
          assetForm={assetForm}
          setAssetForm={setAssetForm}
          handleSaveAsset={handleSaveAsset}
          resetAssetForm={resetAssetForm}
          isLoading={isLoading}
          categories={categories}
          statuses={statuses}
          floors={floors}
          getRoomsForFloor={getRoomsForFloor}
          openPhotoOptions={openPhotoOptions}
          removePhotoFromForm={removePhotoFromForm}
          Icons={Icons}
        />
      )}

      {/* Modal de Sala */}
      {showRoomForm && (
        <RoomFormModal
          showRoomForm={showRoomForm}
          setShowRoomForm={setShowRoomForm}
          editingRoom={editingRoom}
          setEditingRoom={setEditingRoom}
          roomForm={roomForm}
          setRoomForm={setRoomForm}
          handleSaveRoom={handleSaveRoom}
          isLoading={isLoading}
          floors={floors}
          Icons={Icons}
        />
      )}

      {/* Modal de Andar */}
      {showFloorForm && (
        <FloorFormModal
          showFloorForm={showFloorForm}
          setShowFloorForm={setShowFloorForm}
          editingFloor={editingFloor}
          setEditingFloor={setEditingFloor}
          floorForm={floorForm}
          setFloorForm={setFloorForm}
          handleSaveFloor={handleSaveFloor}
          isLoading={isLoading}
          Icons={Icons}
        />
      )}

      {/* Modal de Detalhes do Ativo */}
      {showAssetDetail && (
        <AssetDetailModal
          showAssetDetail={showAssetDetail}
          setShowAssetDetail={setShowAssetDetail}
          handleEditAsset={handleEditAsset}
          getFloorName={getFloorName}
          getRoomName={getRoomName}
          StatusBadge={StatusBadge}
          Icons={Icons}
        />
      )}
    </>
  );
};

// =================== MODAIS SEPARADOS ===================
const AssetFormModal = ({ 
  showAssetForm, 
  setShowAssetForm, 
  editingAsset, 
  setEditingAsset, 
  assetForm, 
  setAssetForm, 
  handleSaveAsset, 
  resetAssetForm, 
  isLoading, 
  categories, 
  statuses, 
  floors, 
  getRoomsForFloor, 
  openPhotoOptions, 
  removePhotoFromForm,
  Icons 
}) => {
  if (!showAssetForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                {editingAsset ? '✏️ Editar Ativo' : '➕ Novo Ativo'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingAsset ? 'Atualize as informações do ativo' : 'Cadastre um novo ativo no sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowAssetForm(false);
                setEditingAsset(null);
                resetAssetForm();
              }}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Nome do Ativo *</label>
                <input
                  type="text"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({...assetForm, name: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: Notebook Dell Inspiron 15"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Código *</label>
                <input
                  type="text"
                  value={assetForm.code}
                  onChange={(e) => setAssetForm({...assetForm, code: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-mono"
                  placeholder="Ex: NB-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
                <select
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({...assetForm, category: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  <option value="">🏷️ Selecione uma categoria</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Status</label>
                <select
                  value={assetForm.status}
                  onChange={(e) => setAssetForm({...assetForm, status: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
                <select
                  value={assetForm.floor_id}
                  onChange={(e) => setAssetForm({...assetForm, floor_id: e.target.value, room_id: ''})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                >
                  <option value="">🏢 Selecione um andar</option>
                  {floors.map(floor => (
                    <option key={floor.id} value={floor.id}>{floor.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Sala</label>
                <select
                  value={assetForm.room_id}
                  onChange={(e) => setAssetForm({...assetForm, room_id: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  disabled={!assetForm.floor_id}
                >
                  <option value="">🚪 Selecione uma sala (opcional)</option>
                  {getRoomsForFloor(assetForm.floor_id).map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* SEÇÃO DE FOTO */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                <div className="space-y-4">
                  {assetForm.photo ? (
                    <div className="relative">
                      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                        <img 
                          src={assetForm.photo} 
                          alt="Foto do ativo" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex space-x-3 mt-4">
                        <button
                          type="button"
                          onClick={openPhotoOptions}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-4 rounded-2xl flex items-center justify-center space-x-3 text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Icons.Camera />
                          <span>📷 Alterar Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={removePhotoFromForm}
                          className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-4 rounded-2xl flex items-center justify-center transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Icons.Trash2 />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={openPhotoOptions}
                      className="w-full h-64 border-4 border-dashed border-purple-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 bg-gradient-to-br from-purple-50/50 via-blue-50/50 to-cyan-50/50 backdrop-blur-sm group"
                    >
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                          <Icons.Camera />
                        </div>
                        <p className="text-gray-700 font-bold text-lg mb-2">📷 Clique para adicionar foto</p>
                        <p className="text-gray-600 font-medium mb-4">
                          Tire uma foto ou escolha da galeria
                        </p>
                        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-2xl text-sm font-bold border border-purple-200">
                          <Icons.Sparkles />
                          <span className="ml-2">Recomendado</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={assetForm.value}
                  onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: 2500.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Fornecedor</label>
                <input
                  type="text"
                  value={assetForm.supplier}
                  onChange={(e) => setAssetForm({...assetForm, supplier: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                  placeholder="Ex: Dell Brasil"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Número de Série</label>
                <input
                  type="text"
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({...assetForm, serial_number: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-mono"
                  placeholder="Ex: DL24001"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
            <textarea
              value={assetForm.description}
              onChange={(e) => setAssetForm({...assetForm, description: e.target.value})}
              rows={4}
              className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
              placeholder="Descrição detalhada do ativo..."
            />
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAssetForm(false);
                setEditingAsset(null);
                resetAssetForm();
              }}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAsset}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingAsset ? '✅ Atualizar Ativo' : '💾 Salvar Ativo'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoomFormModal = ({ 
  showRoomForm, 
  setShowRoomForm, 
  editingRoom, 
  setEditingRoom, 
  roomForm, 
  setRoomForm, 
  handleSaveRoom, 
  isLoading, 
  floors,
  Icons 
}) => {
  if (!showRoomForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-gray-900 bg-clip-text text-transparent">
                {editingRoom ? '✏️ Editar Sala' : '🚪 Nova Sala'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingRoom ? 'Atualize as informações da sala' : 'Adicione uma nova sala ao sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowRoomForm(false);
                setEditingRoom(null);
                setRoomForm({ name: '', description: '', floor_id: '' });
              }}
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Nome da Sala *</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({...roomForm, name: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                placeholder="Ex: Sala de Reuniões A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
              <select
                value={roomForm.floor_id}
                onChange={(e) => setRoomForm({...roomForm, floor_id: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
              >
                <option value="">🏢 Selecione um andar</option>
                {floors.map(floor => (
                  <option key={floor.id} value={floor.id}>{floor.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
              <textarea
                value={roomForm.description}
                onChange={(e) => setRoomForm({...roomForm, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
                placeholder="Descrição da sala..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowRoomForm(false);
                setEditingRoom(null);
                setRoomForm({ name: '', description: '', floor_id: '' });
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveRoom}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingRoom ? '✅ Atualizar Sala' : '💾 Salvar Sala'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FloorFormModal = ({ 
  showFloorForm, 
  setShowFloorForm, 
  editingFloor,
  setEditingFloor,
  floorForm, 
  setFloorForm, 
  handleSaveFloor, 
  isLoading,
  Icons 
}) => {
  if (!showFloorForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                {editingFloor ? '✏️ Editar Andar' : '🏢 Novo Andar'}
              </h3>
              <p className="text-gray-600 mt-2 font-medium">
                {editingFloor ? 'Atualize as informações do andar' : 'Adicione um novo andar ao sistema'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowFloorForm(false);
                setEditingFloor(null);
                setFloorForm({ name: '', description: '' });
              }}
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Nome do Andar *</label>
              <input
                type="text"
                value={floorForm.name}
                onChange={(e) => setFloorForm({...floorForm, name: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium"
                placeholder="Ex: 1º Andar, Térreo, Subsolo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
              <textarea
                value={floorForm.description}
                onChange={(e) => setFloorForm({...floorForm, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium resize-none"
                placeholder="Descrição do andar (opcional)..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowFloorForm(false);
                setEditingFloor(null);
                setFloorForm({ name: '', description: '' });
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFloor}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                editingFloor ? '✅ Atualizar Andar' : '💾 Salvar Andar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AssetDetailModal = ({ 
  showAssetDetail, 
  setShowAssetDetail, 
  handleEditAsset, 
  getFloorName, 
  getRoomName, 
  StatusBadge,
  Icons 
}) => {
  if (!showAssetDetail) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                🔍 Detalhes do Ativo
              </h3>
              <p className="text-gray-600 mt-2 font-medium">Informações completas do ativo</p>
            </div>
            <button
              onClick={() => setShowAssetDetail(null)}
              className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Icons.X />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-700 mb-2">Nome</label>
                <p className="text-xl font-bold text-blue-900">{showAssetDetail.name}</p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                <label className="block text-sm font-bold text-purple-700 mb-2">Código</label>
                <p className="text-lg font-mono font-bold text-purple-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                  {showAssetDetail.code}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
                <label className="block text-sm font-bold text-green-700 mb-3">Categoria</label>
                <span className="inline-block px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-2xl text-sm font-bold border border-green-200">
                  {showAssetDetail.category || 'Sem categoria'}
                </span>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-100">
                <label className="block text-sm font-bold text-orange-700 mb-3">Status</label>
                <StatusBadge status={showAssetDetail.status} />
              </div>
              
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
                <label className="block text-sm font-bold text-indigo-700 mb-2">Localização</label>
                <div className="flex items-center space-x-2 text-indigo-900">
                  <Icons.MapPin />
                  <p className="font-bold text-lg">
                    {getFloorName(showAssetDetail.floor_id)} {showAssetDetail.room_id ? `- ${getRoomName(showAssetDetail.room_id)}` : '(Sem sala específica)'}
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-2xl border border-yellow-100">
                <label className="block text-sm font-bold text-yellow-700 mb-2">Valor</label>
                <div className="flex items-center space-x-2">
                  <Icons.DollarSign />
                  <p className="text-xl font-bold text-yellow-900">
                    {showAssetDetail.value ? 
                      `R$ ${parseFloat(showAssetDetail.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 
                      'Não informado'
                    }
                  </p>
                </div>
              </div>

              {showAssetDetail.supplier && (
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-2xl border border-teal-100">
                  <label className="block text-sm font-bold text-teal-700 mb-2">Fornecedor</label>
                  <p className="text-lg font-bold text-teal-900">{showAssetDetail.supplier}</p>
                </div>
              )}

              {showAssetDetail.serial_number && (
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 rounded-2xl border border-rose-100">
                  <label className="block text-sm font-bold text-rose-700 mb-2">Número de Série</label>
                  <p className="text-lg font-mono font-bold text-rose-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                    {showAssetDetail.serial_number}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                  {showAssetDetail.photo ? (
                    <img 
                      src={showAssetDetail.photo} 
                      alt={showAssetDetail.name} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Icons.Camera />
                        </div>
                        <span className="text-gray-600 font-bold">Nenhuma foto disponível</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {showAssetDetail.description && (
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-2xl border border-slate-200">
                  <label className="block text-sm font-bold text-slate-700 mb-3">📝 Descrição</label>
                  <p className="text-slate-900 font-medium leading-relaxed">{showAssetDetail.description}</p>
                </div>
              )}

              <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-2xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-4">🔧 Informações do Sistema</label>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-gray-600">Criado em:</span>
                    <span className="font-mono text-gray-900">
                      {new Date(showAssetDetail.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-gray-600">Última atualização:</span>
                    <span className="font-mono text-gray-900">
                      {new Date(showAssetDetail.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAssetDetail(null);
                handleEditAsset(showAssetDetail);
              }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center space-x-2">
                <Icons.Edit />
                <span>✏️ Editar Ativo</span>
              </div>
            </button>
            <button
              onClick={() => setShowAssetDetail(null)}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE PRINCIPAL ===================
const App = () => {
  const { user, loading, dbReady, connectionError } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-2xl">
            <Icons.Package />
          </div>
          <div className="space-y-2">
            <p className="text-gray-800 text-xl font-bold">Conectando ao NeonDB...</p>
            <div className="flex items-center justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 max-w-md w-full shadow-2xl border border-white/20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Icons.AlertCircle />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">❌ Erro de Conexão</h2>
          <p className="text-red-600 mb-6 font-medium">{connectionError}</p>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm text-red-700 font-medium">
              💡 Verifique se a variável <code className="bg-red-100 px-2 py-1 rounded font-mono">VITE_DATABASE_URL</code> está configurada corretamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Animated Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          </div>
          
          <div className="max-w-lg w-full relative z-10">
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl transform hover:scale-110 transition-transform duration-300">
                <Icons.Package />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
                AssetManager Pro
              </h1>
              <p className="text-gray-700 text-xl font-medium mb-2">Sistema Inteligente de Controle de Ativos</p>
              <div className="flex items-center justify-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-bold">Autenticação Segura SHA-256</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-white">
                <h2 className="text-3xl font-bold text-center mb-4">🚀 Bem-vindo!</h2>
                <p className="text-center text-blue-100 font-medium">
                  Gerencie seus ativos com tecnologia de ponta
                </p>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.CheckCircle />
                    </div>
                    <div>
                      <p className="font-bold text-blue-900">Gestão Completa de Ativos</p>
                      <p className="text-sm text-blue-700">Controle total dos seus equipamentos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Key />
                    </div>
                    <div>
                      <p className="font-bold text-green-900">Autenticação Segura</p>
                      <p className="text-sm text-green-700">Senhas criptografadas com SHA-256</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Building />
                    </div>
                    <div>
                      <p className="font-bold text-purple-900">Andares Pré-Configurados</p>
                      <p className="text-sm text-purple-700">5º, 11º e 15º andares já cadastrados</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white py-5 px-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                >
                  🔐 Acessar Sistema Seguro
                </button>

                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <Icons.CheckCircle />
                    <span className="text-green-700 font-bold">Sistema com validação de senha</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Sistema pronto para uso • Autenticação obrigatória
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  // Usuário logado - mostrar sistema completo
  return <AssetControlSystem />;
};

const AppWithProvider = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

export default AppWithProvider;
