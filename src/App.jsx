// SISTEMA DE CONTROLE DE ATIVOS COM TEMA SALES PROPOSAL PLANNER
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
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

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
        
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          return { success: false, error: 'Este e-mail já está cadastrado no sistema' };
        }
        
        return { success: false, error: 'Erro interno do servidor. Tente novamente.' };
      }
    },

    async authenticate(email, password) {
      try {
        const sql = await databaseService.getConnection();
        
        const result = await sql`
          SELECT id, email, name, password_hash, company, photo, created_at, updated_at
          FROM users 
          WHERE email = ${email} 
          LIMIT 1
        `;
        
        if (result.length === 0) {
          return { success: false, error: 'E-mail não encontrado. Verifique o endereço digitado.' };
        }
        
        const user = result[0];
        
        const isValidPassword = await CryptoUtils.verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
          return { success: false, error: 'Senha incorreta. Verifique sua senha e tente novamente.' };
        }
        
        const { password_hash, ...userWithoutPassword } = user;
        return { success: true, data: userWithoutPassword };
        
      } catch (error) {
        console.error('Erro na autenticação:', error);
        return { success: false, error: 'Erro de conexão. Verifique sua internet e tente novamente.' };
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
      
      if (!email || !password || !name) {
        return { success: false, error: 'E-mail, senha e nome são obrigatórios' };
      }
      
      if (password.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'E-mail inválido. Por favor, digite um e-mail válido' };
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
      return { success: false, error: 'Erro interno. Tente novamente mais tarde.' };
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
      
      if (!email || !password) {
        return { success: false, error: 'Por favor, preencha e-mail e senha' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Formato de e-mail inválido' };
      }
      
      const result = await databaseService.users.authenticate(email.trim().toLowerCase(), password);
      
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
      return { success: false, error: 'Erro de conexão. Verifique sua internet e tente novamente.' };
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

  const value = {
    user,
    profile,
    loading,
    dbReady,
    connectionError,
    signUp,
    signIn,
    signOut,
    updateProfile
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
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Trash2: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
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
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  EyeOff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  )
};

// =================== MODAL DE AUTENTICAÇÃO COM TEMA SALES ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, dbReady } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', name: '', company: '' });
    setMessage('');
    setMessageType('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!dbReady) {
      showMessage('Banco de dados não está disponível. Tente novamente.', 'error');
      return;
    }

    setMessage('');
    setMessageType('');
    setLoading(true);

    try {
      let result;
      
      if (isLogin) {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.email, formData.password, formData.name, formData.company);
      }

      if (result.success) {
        showMessage(isLogin ? 'Login realizado com sucesso!' : 'Conta criada com sucesso!', 'success');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      showMessage('Erro interno. Tente novamente mais tarde.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-red-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 max-h-[95vh] overflow-y-auto">
        <button
          onClick={() => {
            onClose();
            resetForm();
          }}
          className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
        >
          <Icons.X />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-700 to-red-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
            <Icons.User />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent">
            {isLogin ? '🔐 Entrar no Sistema' : '🚀 Criar Nova Conta'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Acesse sua conta com segurança' : 'Cadastre-se e gerencie seus ativos'}
          </p>
          {!isLogin && (
            <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium flex items-center justify-center">
                <Icons.CheckCircle />
                <span className="ml-2">🔐 Sua senha será criptografada com SHA-256</span>
              </p>
            </div>
          )}
        </div>

        {!dbReady && (
          <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl mb-6">
            <div className="flex items-center space-x-3">
              <Icons.AlertCircle />
              <div>
                <p className="text-red-800 text-sm font-bold">Banco de dados não disponível</p>
                <p className="text-red-600 text-xs">Verifique sua conexão e tente novamente</p>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium transition-all duration-300 ${
            messageType === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {messageType === 'success' ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
              <div>
                <p className="font-bold">
                  {messageType === 'success' ? '✅ Sucesso!' : '❌ Erro'}
                </p>
                <p>{message}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  minLength="2"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Empresa (opcional)
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="Nome da empresa"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              E-mail *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value.toLowerCase()})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="seu@email.com"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Senha *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength="6"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !dbReady}
            className="w-full bg-gradient-to-r from-red-700 to-red-900 hover:from-red-800 hover:to-red-950 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                {isLogin ? 'Entrando...' : 'Criando conta...'}
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                {isLogin ? <Icons.CheckCircle /> : <Icons.User />}
                <span>{isLogin ? '🔐 Entrar' : '🚀 Criar Conta'}</span>
              </div>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={switchMode}
            disabled={loading}
            className="text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
          >
            {isLogin ? (
              <span>Não tem conta? <strong>Criar agora →</strong></span>
            ) : (
              <span>Já tem conta? <strong>← Fazer login</strong></span>
            )}
          </button>
        </div>

        <div className="mt-6 p-3 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-medium text-center">
            🛡️ Seus dados são protegidos com criptografia SHA-256
          </p>
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

// =================== SISTEMA PRINCIPAL COM TEMA SALES ===================
const AssetControlSystem = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('assets');
  const [assets, setAssets] = useState([]);
  const [floors, setFloors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingFloor, setEditingFloor] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Estados do formulário de ativo
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

  // Estados do formulário de andar
  const [floorForm, setFloorForm] = useState({
    name: '',
    description: ''
  });

  // Estados do formulário de sala
  const [roomForm, setRoomForm] = useState({
    name: '',
    description: '',
    floor_id: ''
  });

  const categories = [
    'Computadores e Notebooks',
    'Impressoras e Scanners', 
    'Móveis e Equipamentos',
    'Eletrodomésticos',
    'Ferramentas e Instrumentos',
    'Veículos',
    'Outros'
  ];

  const statuses = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'];

  // Auto-remover mensagens
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [floorsResult, assetsResult] = await Promise.all([
        databaseService.floors.getAll(user.id),
        databaseService.assets.getAll(user.id)
      ]);

      if (floorsResult.success) {
        setFloors(floorsResult.data);
      } else {
        showMessage('Erro ao carregar andares: ' + floorsResult.error, 'error');
      }

      if (assetsResult.success) {
        setAssets(assetsResult.data);
      } else {
        showMessage('Erro ao carregar ativos: ' + assetsResult.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showMessage('Erro ao carregar dados: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Funções auxiliares
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

  const getRoomsForFloor = (floorId) => {
    const floor = floors.find(f => f.id == floorId);
    return floor ? floor.rooms || [] : [];
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
      name: asset.name || '',
      code: asset.code || '',
      category: asset.category || '',
      description: asset.description || '',
      value: asset.value || '',
      status: asset.status || 'Ativo',
      floor_id: asset.floor_id || '',
      room_id: asset.room_id || '',
      photo: asset.photo || null,
      supplier: asset.supplier || '',
      serial_number: asset.serial_number || ''
    });
    setShowAssetForm(true);
  };

  const handleSaveAsset = async () => {
    try {
      if (!assetForm.name || !assetForm.code || !assetForm.floor_id) {
        showMessage('Nome, código e andar são obrigatórios', 'error');
        return;
      }

      setLoading(true);
      
      let result;
      if (editingAsset) {
        result = await databaseService.assets.update(editingAsset.id, assetForm, user.id);
      } else {
        result = await databaseService.assets.create(assetForm, user.id);
      }

      if (result.success) {
        showMessage(
          editingAsset ? 'Ativo atualizado com sucesso!' : 'Ativo criado com sucesso!',
          'success'
        );
        setShowAssetForm(false);
        setEditingAsset(null);
        resetAssetForm();
        await loadData();
      } else {
        showMessage('Erro ao salvar ativo: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar ativo:', error);
      showMessage('Erro ao salvar ativo: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este ativo?')) return;

    try {
      setLoading(true);
      const result = await databaseService.assets.delete(id, user.id);
      
      if (result.success) {
        showMessage('Ativo excluído com sucesso!', 'success');
        await loadData();
      } else {
        showMessage('Erro ao excluir ativo: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir ativo:', error);
      showMessage('Erro ao excluir ativo: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditFloor = (floor) => {
    setEditingFloor(floor);
    setFloorForm({
      name: floor.name || '',
      description: floor.description || ''
    });
    setShowFloorForm(true);
  };

  const handleSaveFloor = async () => {
    try {
      if (!floorForm.name) {
        showMessage('Nome do andar é obrigatório', 'error');
        return;
      }

      setLoading(true);
      
      let result;
      if (editingFloor) {
        result = await databaseService.floors.update(editingFloor.id, floorForm, user.id);
      } else {
        result = await databaseService.floors.create(floorForm, user.id);
      }

      if (result.success) {
        showMessage(
          editingFloor ? 'Andar atualizado com sucesso!' : 'Andar criado com sucesso!',
          'success'
        );
        setShowFloorForm(false);
        setEditingFloor(null);
        setFloorForm({ name: '', description: '' });
        await loadData();
      } else {
        showMessage('Erro ao salvar andar: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar andar:', error);
      showMessage('Erro ao salvar andar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFloor = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este andar? Isso excluirá também todas as salas e ativos vinculados.')) return;

    try {
      setLoading(true);
      const result = await databaseService.floors.delete(id, user.id);
      
      if (result.success) {
        showMessage('Andar excluído com sucesso!', 'success');
        await loadData();
      } else {
        showMessage('Erro ao excluir andar: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir andar:', error);
      showMessage('Erro ao excluir andar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name || '',
      description: room.description || '',
      floor_id: room.floor_id || ''
    });
    setShowRoomForm(true);
  };

  const handleSaveRoom = async () => {
    try {
      if (!roomForm.name || !roomForm.floor_id) {
        showMessage('Nome da sala e andar são obrigatórios', 'error');
        return;
      }

      setLoading(true);
      
      let result;
      if (editingRoom) {
        result = await databaseService.rooms.update(editingRoom.id, roomForm, user.id);
      } else {
        result = await databaseService.rooms.create(roomForm, user.id);
      }

      if (result.success) {
        showMessage(
          editingRoom ? 'Sala atualizada com sucesso!' : 'Sala criada com sucesso!',
          'success'
        );
        setShowRoomForm(false);
        setEditingRoom(null);
        setRoomForm({ name: '', description: '', floor_id: '' });
        await loadData();
      } else {
        showMessage('Erro ao salvar sala: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar sala:', error);
      showMessage('Erro ao salvar sala: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta sala? Isso removerá também todos os ativos vinculados.')) return;

    try {
      setLoading(true);
      const result = await databaseService.rooms.delete(id, user.id);
      
      if (result.success) {
        showMessage('Sala excluída com sucesso!', 'success');
        await loadData();
      } else {
        showMessage('Erro ao excluir sala: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir sala:', error);
      showMessage('Erro ao excluir sala: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      await signOut();
    }
  };

  // Filtrar ativos
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFloor = !filterFloor || asset.floor_id == filterFloor;
    const matchesRoom = !filterRoom || asset.room_id == filterRoom;
    
    return matchesSearch && matchesFloor && matchesRoom;
  });

  // Estatísticas
  const stats = {
    totalAssets: assets.length,
    activeAssets: assets.filter(a => a.status === 'Ativo').length,
    totalFloors: floors.length,
    totalRooms: floors.reduce((acc, floor) => acc + (floor.rooms?.length || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header com tema Sales */}
      <header className="bg-gradient-to-r from-red-800 via-red-700 to-red-900 shadow-2xl border-b-4 border-red-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                <Icons.Package className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  AssetManager Pro
                </h1>
                <p className="text-red-100 font-medium">Sistema de Controle de Ativos</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-white font-bold text-lg">{user?.name}</p>
                <p className="text-red-200 text-sm">{user?.company || 'Usuário'}</p>
              </div>
              
              {user?.photo && (
                <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-white/30 shadow-lg">
                  <img src={user.photo} alt="Foto do usuário" className="w-full h-full object-cover" />
                </div>
              )}
              
              <button
                onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium border border-white/20"
              >
                <Icons.Settings />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mensagens de Feedback */}
      {message && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`p-4 rounded-xl text-sm font-medium transition-all duration-300 shadow-2xl border max-w-sm ${
            messageType === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {messageType === 'success' ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
              <div>
                <p className="font-bold">
                  {messageType === 'success' ? '✅ Sucesso!' : '❌ Erro'}
                </p>
                <p>{message}</p>
              </div>
              <button
                onClick={() => setMessage('')}
                className="ml-2 hover:bg-black/10 rounded-lg p-1 transition-colors"
              >
                <Icons.X />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 font-medium">Total de Ativos</p>
                <p className="text-3xl font-bold">{stats.totalAssets}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.Package />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 font-medium">Ativos Ativos</p>
                <p className="text-3xl font-bold">{stats.activeAssets}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.CheckCircle />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 font-medium">Andares</p>
                <p className="text-3xl font-bold">{stats.totalFloors}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.Building />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 font-medium">Salas</p>
                <p className="text-3xl font-bold">{stats.totalRooms}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.MapPin />
              </div>
            </div>
          </div>
        </div>

        {/* Navegação com tema Sales */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-red-700 to-red-900 px-6 py-4">
            <nav className="flex space-x-1">
              {[
                { id: 'assets', label: '📦 Ativos', icon: Icons.Package },
                { id: 'locations', label: '🏢 Localizações', icon: Icons.Building },
                { id: 'reports', label: '📊 Relatórios', icon: Icons.BarChart3 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium ${
                    activeTab === tab.id
                      ? 'bg-white text-red-700 shadow-lg'
                      : 'text-red-100 hover:bg-white/20'
                  }`}
                >
                  <tab.icon />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Aba de Ativos */}
            {activeTab === 'assets' && (
              <div>
                {/* Filtros e busca */}
                <div className="flex flex-col lg:flex-row justify-between items-center mb-6 space-y-4 lg:space-y-0 lg:space-x-4">
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full lg:w-auto">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Buscar ativos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-80 px-4 py-3 pl-12 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-red-50/50"
                      />
                      <Icons.Eye className="absolute left-4 top-4 text-red-400" />
                    </div>
                    
                    <select
                      value={filterFloor}
                      onChange={(e) => {
                        setFilterFloor(e.target.value);
                        setFilterRoom('');
                      }}
                      className="px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50/50"
                    >
                      <option value="">🏢 Todos os andares</option>
                      {floors.map(floor => (
                        <option key={floor.id} value={floor.id}>{floor.name}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterRoom}
                      onChange={(e) => setFilterRoom(e.target.value)}
                      className="px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50/50"
                      disabled={!filterFloor}
                    >
                      <option value="">🚪 Todas as salas</option>
                      {getRoomsForFloor(filterFloor).map(room => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => setShowAssetForm(true)}
                    className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Icons.Plus />
                    <span>➕ Novo Ativo</span>
                  </button>
                </div>

                {/* Lista de ativos */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAssets.map(asset => (
                    <div key={asset.id} className="bg-gradient-to-br from-white to-red-50/30 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-red-100 overflow-hidden group">
                      {/* Foto do ativo */}
                      <div className="h-48 bg-gradient-to-br from-red-100 to-red-200 relative overflow-hidden">
                        {asset.photo ? (
                          <img 
                            src={asset.photo} 
                            alt={asset.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-16 h-16 bg-red-300 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-600">
                                <Icons.Package />
                              </div>
                              <span className="text-red-600 font-medium">Sem foto</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Código do ativo */}
                        <div className="absolute top-3 left-3">
                          <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-mono font-bold shadow-lg">
                            {asset.code}
                          </span>
                        </div>
                        
                        {/* Status */}
                        <div className="absolute top-3 right-3">
                          <StatusBadge status={asset.status} />
                        </div>
                      </div>
                      
                      {/* Informações do ativo */}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-700 transition-colors">
                          {asset.name}
                        </h3>
                        
                        <div className="space-y-3 mb-4">
                          {asset.category && (
                            <div className="flex items-center text-sm">
                              <span className="w-20 text-red-600 font-medium">Categoria:</span>
                              <span className="text-gray-700 font-medium">{asset.category}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center text-sm">
                            <span className="w-20 text-red-600 font-medium">Local:</span>
                            <span className="text-gray-700 font-medium">
                              {getFloorName(asset.floor_id)} 
                              {asset.room_id && ` - ${getRoomName(asset.room_id)}`}
                            </span>
                          </div>
                          
                          {asset.value && (
                            <div className="flex items-center text-sm">
                              <span className="w-20 text-red-600 font-medium">Valor:</span>
                              <span className="text-gray-700 font-bold">
                                R$ {parseFloat(asset.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Ações */}
                        <div className="flex justify-between items-center pt-4 border-t border-red-100">
                          <button
                            onClick={() => setShowAssetDetail(asset)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 p-3 rounded-xl transition-colors"
                            title="Ver detalhes"
                          >
                            <Icons.Eye />
                          </button>
                          
                          <button
                            onClick={() => handleEditAsset(asset)}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-3 rounded-xl transition-colors"
                            title="Editar"
                          >
                            <Icons.Edit />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 p-3 rounded-xl transition-colors"
                            title="Excluir"
                          >
                            <Icons.Trash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredAssets.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                        <Icons.Package />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum ativo encontrado</h3>
                      <p className="text-gray-600 mb-6">
                        {searchTerm || filterFloor || filterRoom 
                          ? 'Tente ajustar os filtros de busca'
                          : 'Comece adicionando seu primeiro ativo'
                        }
                      </p>
                      {!searchTerm && !filterFloor && !filterRoom && (
                        <button
                          onClick={() => setShowAssetForm(true)}
                          className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-6 py-3 rounded-xl flex items-center space-x-2 mx-auto transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Icons.Plus />
                          <span>➕ Adicionar Primeiro Ativo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Aba de Localizações */}
            {activeTab === 'locations' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-red-900">🏢 Gerenciar Localizações</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowFloorForm(true)}
                      className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Icons.Plus />
                      <span>➕ Novo Andar</span>
                    </button>
                    <button
                      onClick={() => setShowRoomForm(true)}
                      className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Icons.Plus />
                      <span>➕ Nova Sala</span>
                    </button>
                  </div>
                </div>

                {/* Lista de andares e salas */}
                <div className="space-y-6">
                  {floors.map(floor => (
                    <div key={floor.id} className="bg-gradient-to-br from-white to-red-50/30 rounded-2xl shadow-lg border border-red-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 text-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">{floor.name}</h3>
                            {floor.description && (
                              <p className="text-red-100">{floor.description}</p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditFloor(floor)}
                              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                              title="Editar andar"
                            >
                              <Icons.Edit />
                            </button>
                            <button
                              onClick={() => handleDeleteFloor(floor.id)}
                              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                              title="Excluir andar"
                            >
                              <Icons.Trash2 />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-6">
                        {floor.rooms && floor.rooms.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {floor.rooms.map(room => (
                              <div key={room.id} className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="font-bold text-red-900">{room.name}</h4>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => handleEditRoom(room)}
                                      className="bg-red-200 hover:bg-red-300 p-1 rounded transition-colors"
                                      title="Editar sala"
                                    >
                                      <Icons.Edit />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRoom(room.id)}
                                      className="bg-red-200 hover:bg-red-300 p-1 rounded transition-colors"
                                      title="Excluir sala"
                                    >
                                      <Icons.Trash2 />
                                    </button>
                                  </div>
                                </div>
                                {room.description && (
                                  <p className="text-red-700 text-sm">{room.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                              <Icons.Building />
                            </div>
                            <p className="text-red-600 font-medium">Nenhuma sala cadastrada neste andar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {floors.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                        <Icons.Building />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum andar cadastrado</h3>
                      <p className="text-gray-600 mb-6">Comece adicionando seu primeiro andar</p>
                      <button
                        onClick={() => setShowFloorForm(true)}
                        className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-6 py-3 rounded-xl flex items-center space-x-2 mx-auto transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Icons.Plus />
                        <span>➕ Adicionar Primeiro Andar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Aba de Relatórios */}
            {activeTab === 'reports' && (
              <div>
                <h2 className="text-2xl font-bold text-red-900 mb-6">📊 Relatórios e Estatísticas</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Resumo por Status */}
                  <div className="bg-gradient-to-br from-white to-red-50/30 p-6 rounded-2xl shadow-lg border border-red-100">
                    <h3 className="text-lg font-bold text-red-900 mb-4">Status dos Ativos</h3>
                    <div className="space-y-3">
                      {statuses.map(status => {
                        const count = assets.filter(a => a.status === status).length;
                        const percentage = assets.length > 0 ? (count / assets.length * 100).toFixed(1) : 0;
                        
                        return (
                          <div key={status} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                            <div className="flex items-center space-x-3">
                              <StatusBadge status={status} />
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-red-900">{count}</p>
                              <p className="text-sm text-red-600">{percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Resumo por Categoria */}
                  <div className="bg-gradient-to-br from-white to-red-50/30 p-6 rounded-2xl shadow-lg border border-red-100">
                    <h3 className="text-lg font-bold text-red-900 mb-4">Ativos por Categoria</h3>
                    <div className="space-y-3">
                      {categories.map(category => {
                        const count = assets.filter(a => a.category === category).length;
                        if (count === 0) return null;
                        
                        const percentage = (count / assets.length * 100).toFixed(1);
                        
                        return (
                          <div key={category} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                            <span className="font-medium text-red-800">{category}</span>
                            <div className="text-right">
                              <p className="font-bold text-red-900">{count}</p>
                              <p className="text-sm text-red-600">{percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                      
                      {assets.filter(a => !a.category).length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                          <span className="font-medium text-red-800">Sem categoria</span>
                          <div className="text-right">
                            <p className="font-bold text-red-900">{assets.filter(a => !a.category).length}</p>
                            <p className="text-sm text-red-600">
                              {((assets.filter(a => !a.category).length / assets.length) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Resumo por Andar */}
                  <div className="bg-gradient-to-br from-white to-red-50/30 p-6 rounded-2xl shadow-lg border border-red-100 lg:col-span-2">
                    <h3 className="text-lg font-bold text-red-900 mb-4">Ativos por Andar</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {floors.map(floor => {
                        const count = assets.filter(a => a.floor_id == floor.id).length;
                        const percentage = assets.length > 0 ? (count / assets.length * 100).toFixed(1) : 0;
                        
                        return (
                          <div key={floor.id} className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                            <h4 className="font-bold text-red-900 mb-2">{floor.name}</h4>
                            <div className="flex justify-between items-center">
                              <span className="text-red-700">Total de ativos:</span>
                              <div className="text-right">
                                <p className="font-bold text-red-900">{count}</p>
                                <p className="text-sm text-red-600">{percentage}%</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modais com tema Sales */}
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
          isLoading={loading}
          categories={categories}
          statuses={statuses}
          floors={floors}
          getRoomsForFloor={getRoomsForFloor}
          Icons={Icons}
        />
      )}

      {showFloorForm && (
        <FloorFormModal 
          showFloorForm={showFloorForm}
          setShowFloorForm={setShowFloorForm}
          editingFloor={editingFloor}
          setEditingFloor={setEditingFloor}
          floorForm={floorForm}
          setFloorForm={setFloorForm}
          handleSaveFloor={handleSaveFloor}
          isLoading={loading}
          Icons={Icons}
        />
      )}

      {showRoomForm && (
        <RoomFormModal 
          showRoomForm={showRoomForm}
          setShowRoomForm={setShowRoomForm}
          editingRoom={editingRoom}
          setEditingRoom={setEditingRoom}
          roomForm={roomForm}
          setRoomForm={setRoomForm}
          handleSaveRoom={handleSaveRoom}
          isLoading={loading}
          floors={floors}
          Icons={Icons}
        />
      )}

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

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-red-900 font-medium">Processando...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// =================== MODAIS COM TEMA SALES ===================
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
  Icons 
}) => {
  if (!showAssetForm) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-red-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent">
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
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
                  placeholder="Ex: Notebook Dell Inspiron 15"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Código *</label>
                <input
                  type="text"
                  value={assetForm.code}
                  onChange={(e) => setAssetForm({...assetForm, code: e.target.value})}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-mono"
                  placeholder="Ex: NB-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
                <select
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({...assetForm, category: e.target.value})}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
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
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
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
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
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
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
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
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={assetForm.value}
                  onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
                  placeholder="Ex: 2500.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Fornecedor</label>
                <input
                  type="text"
                  value={assetForm.supplier}
                  onChange={(e) => setAssetForm({...assetForm, supplier: e.target.value})}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
                  placeholder="Ex: Dell Brasil"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Número de Série</label>
                <input
                  type="text"
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({...assetForm, serial_number: e.target.value})}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-mono"
                  placeholder="Ex: DL24001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
                <textarea
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({...assetForm, description: e.target.value})}
                  rows={6}
                  className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium resize-none"
                  placeholder="Descrição detalhada do ativo..."
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-red-200">
            <button
              onClick={() => {
                setShowAssetForm(false);
                setEditingAsset(null);
                resetAssetForm();
              }}
              className="px-8 py-4 border-2 border-red-300 text-red-700 rounded-2xl hover:bg-red-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAsset}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
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
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-red-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent">
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
                className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
                placeholder="Ex: 1º Andar, Térreo, Subsolo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
              <textarea
                value={floorForm.description}
                onChange={(e) => setFloorForm({...floorForm, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium resize-none"
                placeholder="Descrição do andar (opcional)..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-red-200">
            <button
              onClick={() => {
                setShowFloorForm(false);
                setEditingFloor(null);
                setFloorForm({ name: '', description: '' });
              }}
              className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-2xl hover:bg-red-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFloor}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
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
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-red-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent">
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
                className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
                placeholder="Ex: Sala de Reuniões A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
              <select
                value={roomForm.floor_id}
                onChange={(e) => setRoomForm({...roomForm, floor_id: e.target.value})}
                className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium"
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
                className="w-full px-4 py-4 border border-red-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-red-50/30 font-medium resize-none"
                placeholder="Descrição da sala..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-red-200">
            <button
              onClick={() => {
                setShowRoomForm(false);
                setEditingRoom(null);
                setRoomForm({ name: '', description: '', floor_id: '' });
              }}
              className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-2xl hover:bg-red-50 transition-all font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveRoom}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
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
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-red-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent">
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
              <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-2xl border border-red-200">
                <label className="block text-sm font-bold text-red-700 mb-2">Nome</label>
                <p className="text-xl font-bold text-red-900">{showAssetDetail.name}</p>
              </div>
              
              <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-2xl border border-red-200">
                <label className="block text-sm font-bold text-red-700 mb-2">Código</label>
                <p className="text-lg font-mono font-bold text-red-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                  {showAssetDetail.code}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
                <label className="block text-sm font-bold text-green-700 mb-3">Categoria</label>
                <span className="inline-block px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-2xl text-sm font-bold border border-green-200">
                  {showAssetDetail.category || 'Sem categoria'}
                </span>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-200">
                <label className="block text-sm font-bold text-orange-700 mb-3">Status</label>
                <StatusBadge status={showAssetDetail.status} />
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-200">
                <label className="block text-sm font-bold text-blue-700 mb-2">Localização</label>
                <div className="flex items-center space-x-2 text-blue-900">
                  <Icons.MapPin />
                  <p className="font-bold text-lg">
                    {getFloorName(showAssetDetail.floor_id)} {showAssetDetail.room_id ? `- ${getRoomName(showAssetDetail.room_id)}` : '(Sem sala específica)'}
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-2xl border border-yellow-200">
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
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-2xl border border-teal-200">
                  <label className="block text-sm font-bold text-teal-700 mb-2">Fornecedor</label>
                  <p className="text-lg font-bold text-teal-900">{showAssetDetail.supplier}</p>
                </div>
              )}

              {showAssetDetail.serial_number && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-200">
                  <label className="block text-sm font-bold text-purple-700 mb-2">Número de Série</label>
                  <p className="text-lg font-mono font-bold text-purple-900 bg-white/70 px-3 py-2 rounded-xl inline-block">
                    {showAssetDetail.serial_number}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                <div className="w-full h-80 bg-gradient-to-br from-red-100 to-red-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                  {showAssetDetail.photo ? (
                    <img 
                      src={showAssetDetail.photo} 
                      alt={showAssetDetail.name} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-200 to-red-300">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
                          <Icons.Camera />
                        </div>
                        <span className="text-red-600 font-bold">Nenhuma foto disponível</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {showAssetDetail.description && (
                <div className="bg-gradient-to-r from-gray-50 to-red-50 p-6 rounded-2xl border border-red-200">
                  <label className="block text-sm font-bold text-red-700 mb-3">📝 Descrição</label>
                  <p className="text-red-900 font-medium leading-relaxed">{showAssetDetail.description}</p>
                </div>
              )}

              <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-2xl border border-red-200">
                <label className="block text-sm font-bold text-red-700 mb-4">🔧 Informações do Sistema</label>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-red-600">Criado em:</span>
                    <span className="font-mono text-red-900">
                      {new Date(showAssetDetail.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
                    <span className="font-bold text-red-600">Última atualização:</span>
                    <span className="font-mono text-red-900">
                      {new Date(showAssetDetail.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-red-200">
            <button
              onClick={() => {
                setShowAssetDetail(null);
                handleEditAsset(showAssetDetail);
              }}
              className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white rounded-2xl transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center space-x-2">
                <Icons.Edit />
                <span>✏️ Editar Ativo</span>
              </div>
            </button>
            <button
              onClick={() => setShowAssetDetail(null)}
              className="px-8 py-4 border-2 border-red-300 text-red-700 rounded-2xl hover:bg-red-50 transition-all font-bold"
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-2xl text-white">
            <Icons.Package />
          </div>
          <div className="space-y-2">
            <p className="text-red-800 text-xl font-bold">Conectando ao NeonDB...</p>
            <div className="flex items-center justify-center space-x-1">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-red-700 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-red-800 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
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
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-white">
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
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Animated Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-400/20 to-red-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          </div>
          
          <div className="max-w-lg w-full relative z-10">
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl transform hover:scale-110 transition-transform duration-300 text-white">
                <Icons.Package />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-900 bg-clip-text text-transparent mb-4">
                AssetManager Pro
              </h1>
              <p className="text-red-700 text-xl font-medium mb-2">Sistema Inteligente de Controle de Ativos</p>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 p-8 text-white">
                <h2 className="text-3xl font-bold text-center mb-4">🚀 Bem-vindo!</h2>
                <p className="text-center text-red-100 font-medium">
                  Gerencie seus ativos com tecnologia de ponta
                </p>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-2xl border border-red-200">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-lg text-white">
                      <Icons.CheckCircle />
                    </div>
                    <div>
                      <p className="font-bold text-red-900">Gestão Completa de Ativos</p>
                      <p className="text-sm text-red-700">Controle total dos seus equipamentos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-2xl border border-red-200">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-lg text-white">
                      <Icons.Camera />
                    </div>
                    <div>
                      <p className="font-bold text-red-900">Fotos Inteligentes</p>
                      <p className="text-sm text-red-700">Capture fotos diretamente no sistema</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-2xl border border-red-200">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-lg text-white">
                      <Icons.Building />
                    </div>
                    <div>
                      <p className="font-bold text-red-900">Andares Pré-Configurados</p>
                      <p className="text-sm text-red-700">5º, 11º e 15º andares já cadastrados</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 text-white py-5 px-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                >
                  🚀 Acessar Sistema
                </button>

                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <Icons.CheckCircle className="text-green-600" />
                    <span className="text-green-700 font-bold">Conexão com NeonDB estabelecida</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    ©1995-2025 Integration Consulting and any of its affiliates. All rights reserved.
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
