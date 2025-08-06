// SISTEMA PROFISSIONAL DE CONTROLE DE ATIVOS - VERSÃO REFATORADA
// Aplicando as melhores práticas e arquitetura moderna

import React, { 
  useState, 
  useEffect, 
  createContext, 
  useContext, 
  useRef, 
  useCallback, 
  useMemo 
} from 'react';

// =================== TIPOS E CONSTANTES ===================
const APP_CONFIG = {
  APP_NAME: 'AssetManager Pro',
  VERSION: '2.0.0',
  STORAGE_KEYS: {
    USER: 'asset_manager_user_v2',
    SESSION: 'asset_manager_session'
  },
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MESSAGE_TIMEOUT: 5000
  },
  CATEGORIES: [
    'Informática', 'Móveis', 'Equipamentos', 'Veículos', 'Ferramentas',
    'Eletrônicos', 'Eletrodomésticos', 'Máquinas', 'Instrumentos'
  ],
  STATUSES: ['Ativo', 'Inativo', 'Manutenção', 'Descartado'],
  DEFAULT_FLOORS: [
    { name: '5º Andar', description: 'Quinto andar - Administrativo e Financeiro' },
    { name: '11º Andar', description: 'Décimo primeiro andar - Tecnologia e Inovação' },
    { name: '15º Andar', description: 'Décimo quinto andar - Diretoria Executiva' }
  ]
};

// =================== UTILITÁRIOS DE CRIPTOGRAFIA ===================
class CryptoService {
  static async hashPassword(password) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('❌ Erro ao gerar hash:', error);
      throw new Error('Erro na criptografia da senha');
    }
  }

  static async verifyPassword(password, hash) {
    try {
      if (!password || !hash) return false;
      const passwordHash = await this.hashPassword(password);
      return passwordHash === hash;
    } catch (error) {
      console.error('❌ Erro ao verificar senha:', error);
      return false;
    }
  }
}

// =================== SERVIÇOS DE BANCO DE DADOS ===================
class DatabaseService {
  static async getConnection() {
    try {
      if (!import.meta.env.VITE_DATABASE_URL) {
        throw new Error('VITE_DATABASE_URL não configurada');
      }
      
      const { neon } = await import('@neondatabase/serverless');
      return neon(import.meta.env.VITE_DATABASE_URL);
    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      throw error;
    }
  }

  static async testConnection() {
    try {
      const sql = await this.getConnection();
      await sql`SELECT NOW() as current_time`;
      return { success: true };
    } catch (error) {
      console.error('❌ Teste de conexão falhou:', error);
      return { success: false, error: error.message };
    }
  }

  static async initializeDatabase() {
    try {
      const sql = await this.getConnection();

      // Criar tabela de usuários
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

      // Verificar e adicionar coluna password_hash se não existir
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`;

      // Criar outras tabelas
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

      return { success: true };
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      return { success: false, error: error.message };
    }
  }

  // Métodos para usuários
  static async createUser(userData) {
    try {
      const sql = await this.getConnection();
      const passwordHash = await CryptoService.hashPassword(userData.password);
      
      const result = await sql`
        INSERT INTO users (email, name, password_hash, company, photo)
        VALUES (
          ${userData.email.toLowerCase()}, 
          ${userData.name}, 
          ${passwordHash}, 
          ${userData.company || null}, 
          ${userData.photo || null}
        )
        RETURNING id, email, name, company, photo, created_at, updated_at
      `;
      
      return { success: true, data: result[0] };
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return { success: false, error: 'Este e-mail já está cadastrado no sistema' };
      }
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  static async authenticateUser(email, password) {
    try {
      const sql = await this.getConnection();
      
      const result = await sql`
        SELECT id, email, name, password_hash, company, photo, created_at, updated_at
        FROM users 
        WHERE LOWER(email) = LOWER(${email})
        LIMIT 1
      `;
      
      if (result.length === 0) {
        return { success: false, error: 'E-mail não encontrado. Verifique o endereço digitado.' };
      }
      
      const user = result[0];
      
      if (!user.password_hash) {
        return { success: false, error: 'Conta não configurada corretamente. Entre em contato com o suporte.' };
      }
      
      const isValidPassword = await CryptoService.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return { success: false, error: 'Senha incorreta. Verifique sua senha e tente novamente.' };
      }
      
      const { password_hash, ...userWithoutPassword } = user;
      return { success: true, data: userWithoutPassword };
      
    } catch (error) {
      console.error('❌ Erro na autenticação:', error);
      return { success: false, error: 'Erro de conexão. Verifique sua internet.' };
    }
  }

  static async updateUser(id, updates) {
    try {
      const sql = await this.getConnection();
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
      console.error('❌ Erro ao atualizar usuário:', error);
      return { success: false, error: 'Erro ao atualizar perfil' };
    }
  }

  static async updateUserPassword(id, newPassword) {
    try {
      const sql = await this.getConnection();
      const passwordHash = await CryptoService.hashPassword(newPassword);
      
      await sql`
        UPDATE users 
        SET password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      return { success: false, error: 'Erro ao alterar senha' };
    }
  }

  // Métodos para andares
  static async getFloors(userId) {
    try {
      const sql = await this.getConnection();
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
      console.error('❌ Erro ao buscar andares:', error);
      return { success: false, error: 'Erro ao carregar andares' };
    }
  }

  static async createFloor(floorData, userId) {
    try {
      const sql = await this.getConnection();
      const result = await sql`
        INSERT INTO floors (name, description, user_id)
        VALUES (${floorData.name}, ${floorData.description || null}, ${userId})
        RETURNING *
      `;
      return { success: true, data: result[0] };
    } catch (error) {
      console.error('❌ Erro ao criar andar:', error);
      return { success: false, error: 'Erro ao criar andar' };
    }
  }

  // Métodos para salas
  static async createRoom(roomData, userId) {
    try {
      const sql = await this.getConnection();
      const result = await sql`
        INSERT INTO rooms (name, description, floor_id, user_id)
        VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${userId})
        RETURNING *
      `;
      return { success: true, data: result[0] };
    } catch (error) {
      console.error('❌ Erro ao criar sala:', error);
      return { success: false, error: 'Erro ao criar sala' };
    }
  }

  static async updateRoom(id, updates, userId) {
    try {
      const sql = await this.getConnection();
      const result = await sql`
        UPDATE rooms 
        SET name = ${updates.name}, 
            description = ${updates.description || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      return { success: true, data: result[0] };
    } catch (error) {
      console.error('❌ Erro ao atualizar sala:', error);
      return { success: false, error: 'Erro ao atualizar sala' };
    }
  }

  static async deleteRoom(id, userId) {
    try {
      const sql = await this.getConnection();
      
      const assetsCheck = await sql`
        SELECT COUNT(*) as count FROM assets WHERE room_id = ${id} AND user_id = ${userId}
      `;
      
      if (parseInt(assetsCheck[0].count) > 0) {
        return { success: false, error: 'Não é possível excluir a sala pois existem ativos vinculados' };
      }

      await sql`DELETE FROM rooms WHERE id = ${id} AND user_id = ${userId}`;
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao excluir sala:', error);
      return { success: false, error: 'Erro ao excluir sala' };
    }
  }

  // Métodos para ativos
  static async getAssets(userId) {
    try {
      const sql = await this.getConnection();
      const result = await sql`
        SELECT * FROM assets WHERE user_id = ${userId} ORDER BY created_at DESC
      `;
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Erro ao buscar ativos:', error);
      return { success: false, error: 'Erro ao carregar ativos' };
    }
  }

  static async createAsset(assetData, userId) {
    try {
      const sql = await this.getConnection();
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
      console.error('❌ Erro ao criar ativo:', error);
      return { success: false, error: 'Erro ao criar ativo' };
    }
  }

  static async updateAsset(id, updates, userId) {
    try {
      const sql = await this.getConnection();
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
      console.error('❌ Erro ao atualizar ativo:', error);
      return { success: false, error: 'Erro ao atualizar ativo' };
    }
  }

  static async deleteAsset(id, userId) {
    try {
      const sql = await this.getConnection();
      await sql`DELETE FROM assets WHERE id = ${id} AND user_id = ${userId}`;
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao excluir ativo:', error);
      return { success: false, error: 'Erro ao excluir ativo' };
    }
  }
}

// =================== UTILITÁRIOS DE VALIDAÇÃO ===================
class ValidationService {
  static validateEmail(email) {
    if (!email) return { isValid: false, error: 'E-mail é obrigatório' };
    if (!APP_CONFIG.VALIDATION.EMAIL_REGEX.test(email)) {
      return { isValid: false, error: 'E-mail inválido' };
    }
    return { isValid: true };
  }

  static validatePassword(password) {
    if (!password) return { isValid: false, error: 'Senha é obrigatória' };
    if (password.length < APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
      return { isValid: false, error: `Senha deve ter pelo menos ${APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caracteres` };
    }
    return { isValid: true };
  }

  static validateName(name) {
    if (!name) return { isValid: false, error: 'Nome é obrigatório' };
    if (name.trim().length < 2) return { isValid: false, error: 'Nome muito curto' };
    return { isValid: true };
  }

  static validateAsset(asset) {
    const errors = [];
    
    if (!asset.name) errors.push('Nome é obrigatório');
    if (!asset.code) errors.push('Código é obrigatório');
    if (!asset.floor_id) errors.push('Andar é obrigatório');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// =================== HOOK DE NOTIFICAÇÕES ===================
const useNotification = () => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'error') => {
    const id = Date.now();
    setNotification({ id, message, type });
    
    setTimeout(() => {
      setNotification(null);
    }, APP_CONFIG.VALIDATION.MESSAGE_TIMEOUT);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return { notification, showNotification, hideNotification };
};

// =================== CONTEXT DE AUTENTICAÇÃO ===================
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Inicializar aplicação
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        
        // Testar conexão
        const connectionTest = await DatabaseService.testConnection();
        if (!connectionTest.success) {
          setConnectionError('Falha na conexão com banco de dados');
          return;
        }

        // Inicializar banco
        const dbInit = await DatabaseService.initializeDatabase();
        if (!dbInit.success) {
          setConnectionError('Falha ao inicializar banco de dados');
          return;
        }

        setDbReady(true);
        setConnectionError(null);

        // Verificar usuário salvo
        const savedUser = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            await createDefaultFloorsIfNeeded(userData.id);
          } catch (error) {
            console.error('❌ Erro ao carregar usuário salvo:', error);
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
          }
        }
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setConnectionError('Erro ao inicializar aplicação');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Criar andares padrão se necessário
  const createDefaultFloorsIfNeeded = async (userId) => {
    try {
      const existingFloors = await DatabaseService.getFloors(userId);
      if (!existingFloors.success) return;

      const floorNames = existingFloors.data.map(floor => floor.name.toLowerCase());
      
      for (const floorData of APP_CONFIG.DEFAULT_FLOORS) {
        const floorExists = floorNames.some(name => 
          ['5', '11', '15'].some(num => 
            floorData.name.includes(num) && name.includes(num)
          )
        );

        if (!floorExists) {
          const result = await DatabaseService.createFloor(floorData, userId);
          if (result.success) {
            await createDefaultRoomsForFloor(result.data.id, userId, floorData.name);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao criar andares padrão:', error);
    }
  };

  const createDefaultRoomsForFloor = async (floorId, userId, floorName) => {
    const roomsMap = {
      '5': [
        { name: 'Sala de Reuniões 501', description: 'Sala de reuniões principal' },
        { name: 'Departamento Financeiro', description: 'Setor financeiro e contábil' },
        { name: 'Recursos Humanos', description: 'Departamento de RH' }
      ],
      '11': [
        { name: 'Sala de Desenvolvimento', description: 'Equipe de desenvolvimento de software' },
        { name: 'Laboratório de Testes', description: 'Ambiente para testes e homologação' },
        { name: 'Sala de Inovação', description: 'Espaço para brainstorming e inovação' }
      ],
      '15': [
        { name: 'Sala da Diretoria', description: 'Sala do conselho executivo' },
        { name: 'Sala de Reuniões Executiva', description: 'Reuniões de alta gestão' },
        { name: 'Secretaria Executiva', description: 'Suporte à diretoria' }
      ]
    };

    const floorNumber = floorName.match(/(\d+)/)?.[0];
    const defaultRooms = roomsMap[floorNumber] || [];

    for (const roomData of defaultRooms) {
      await DatabaseService.createRoom({ ...roomData, floor_id: floorId }, userId);
    }
  };

  // Métodos de autenticação
  const signUp = useCallback(async (email, password, name, company = '', photo = null) => {
    if (!dbReady) {
      return { success: false, error: 'Sistema não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações
      const emailValidation = ValidationService.validateEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.error };
      }
      
      const passwordValidation = ValidationService.validatePassword(password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }
      
      const nameValidation = ValidationService.validateName(name);
      if (!nameValidation.isValid) {
        return { success: false, error: nameValidation.error };
      }
      
      const result = await DatabaseService.createUser({
        email, password, name, company, photo
      });

      if (result.success) {
        const userData = result.data;
        setUser(userData);
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(userData));
        await createDefaultFloorsIfNeeded(userData.id);
        return { success: true, data: userData };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Erro no registro:', error);
      return { success: false, error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  }, [dbReady]);

  const signIn = useCallback(async (email, password) => {
    if (!dbReady) {
      return { success: false, error: 'Sistema não disponível' };
    }

    try {
      setLoading(true);
      
      // Validações
      const emailValidation = ValidationService.validateEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.error };
      }
      
      const passwordValidation = ValidationService.validatePassword(password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }
      
      const result = await DatabaseService.authenticateUser(email.trim().toLowerCase(), password);
      
      if (result.success) {
        const userData = result.data;
        setUser(userData);
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(userData));
        await createDefaultFloorsIfNeeded(userData.id);
        return { success: true, data: userData };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Erro no login:', error);
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, [dbReady]);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setUser(null);
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
      return { success: true };
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      return { success: false, error: 'Erro ao sair' };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      const result = await DatabaseService.updateUser(user.id, updates);
      
      if (result.success) {
        const updatedUser = result.data;
        setUser(updatedUser);
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        return { success: true, data: updatedUser };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      return { success: false, error: 'Erro ao atualizar perfil' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const changePassword = useCallback(async (newPassword) => {
    if (!user) return { success: false, error: 'Usuário não logado' };

    try {
      setLoading(true);
      
      const passwordValidation = ValidationService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }
      
      const result = await DatabaseService.updateUserPassword(user.id, newPassword);
      
      if (result.success) {
        return { success: true, message: 'Senha alterada com sucesso' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Erro ao alterar senha:', error);
      return { success: false, error: 'Erro ao alterar senha' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    dbReady,
    connectionError,
    signUp,
    signIn,
    signOut,
    updateProfile,
    changePassword
  }), [user, loading, dbReady, connectionError, signUp, signIn, signOut, updateProfile, changePassword]);

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
  EyeOff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
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
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
  Sparkles: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.5 1.5L5 6L3.5 4.5L5 3zM19 3l1.5 1.5L19 6l-1.5-1.5L19 3zM12 12l3-3 3 3-3 3-3-3zM5 21l1.5-1.5L5 18l-1.5 1.5L5 21zM19 21l1.5-1.5L19 18l-1.5 1.5L19 21z" />
    </svg>
  )
};

// =================== COMPONENTE DE NOTIFICAÇÃO ===================
const NotificationBanner = ({ notification, onClose }) => {
  if (!notification) return null;

  const { message, type } = notification;
  const isSuccess = type === 'success';

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border-2 max-w-md ${
      isSuccess 
        ? 'bg-green-50 text-green-800 border-green-200' 
        : 'bg-red-50 text-red-800 border-red-200'
    } animate-in slide-in-from-top-2 fade-in duration-300`}>
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-center space-x-3">
          {isSuccess ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
          <div>
            <p className="font-bold">
              {isSuccess ? '✅ Sucesso!' : '❌ Erro'}
            </p>
            <p className="text-sm">{message}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:${isSuccess ? 'bg-green-200' : 'bg-red-200'} transition-colors`}
        >
          <Icons.X />
        </button>
      </div>
    </div>
  );
};

// =================== MODAL DE AUTENTICAÇÃO REFATORADO ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  
  const { signIn, signUp, dbReady } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  const resetForm = useCallback(() => {
    setFormData({ email: '', password: '', name: '', company: '' });
    setUserPhoto(null);
    hideNotification();
  }, [hideNotification]);

  const switchMode = useCallback(() => {
    setIsLogin(!isLogin);
    resetForm();
  }, [isLogin, resetForm]);

  // Utilitários de foto
  const PhotoService = {
    fileToBase64: (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    },

    resizeImage: (file, maxWidth = 400, maxHeight = 400, quality = 0.8) => {
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
        if (!navigator.mediaDevices?.getUserMedia) {
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
                
                stream.getTracks().forEach(track => track.stop());
                
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
          reject(new Error('Não foi possível acessar a câmera. Verifique as permissões.'));
        });
      });
    }
  };

  const handlePhotoCapture = useCallback(async () => {
    try {
      const photo = await PhotoService.captureFromCamera();
      setUserPhoto(photo);
      setShowPhotoOptions(false);
      showNotification('Foto capturada com sucesso!', 'success');
    } catch (error) {
      console.error('❌ Erro ao capturar foto:', error);
      showNotification('Erro ao acessar câmera: ' + error.message, 'error');
    }
  }, [showNotification]);

  const handlePhotoGallery = useCallback(() => {
    fileInputRef.current?.click();
    setShowPhotoOptions(false);
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const resizedPhoto = await PhotoService.resizeImage(file, 400, 400, 0.8);
        setUserPhoto(resizedPhoto);
        showNotification('Foto selecionada com sucesso!', 'success');
      } catch (error) {
        console.error('❌ Erro ao processar foto:', error);
        showNotification('Erro ao processar foto: ' + error.message, 'error');
      }
    }
  }, [showNotification]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!dbReady) {
      showNotification('Sistema não disponível. Tente novamente.', 'error');
      return;
    }

    setLoading(true);
    hideNotification();

    try {
      let result;
      
      if (isLogin) {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.email, formData.password, formData.name, formData.company, userPhoto);
      }

      if (result.success) {
        showNotification(isLogin ? 'Login realizado com sucesso!' : 'Conta criada com sucesso!', 'success');
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
      } else {
        showNotification(result.error, 'error');
      }
    } catch (error) {
      console.error('❌ Erro na autenticação:', error);
      showNotification('Erro interno. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dbReady, isLogin, formData, userPhoto, signIn, signUp, showNotification, hideNotification, onClose, resetForm]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-purple-900/60 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 max-h-[95vh] overflow-y-auto">
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
          >
            <Icons.X />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Icons.User />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
              {isLogin ? '🔐 Entrar no Sistema' : '🚀 Criar Nova Conta'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isLogin ? 'Acesse sua conta com segurança' : 'Cadastre-se e gerencie seus ativos'}
            </p>
            {!isLogin && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium flex items-center justify-center">
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
                  <p className="text-red-800 text-sm font-bold">Sistema não disponível</p>
                  <p className="text-red-600 text-xs">Verifique sua conexão e tente novamente</p>
                </div>
              </div>
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
                </div>

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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                  minLength={APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder={`Mínimo ${APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caracteres`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <Icons.Key />
                <span className="ml-1">
                  {isLogin ? 'Digite sua senha de acesso' : 'Será criptografada com SHA-256'}
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !dbReady}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
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
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {isLogin ? (
                <span>Não tem conta? <strong>Criar agora →</strong></span>
              ) : (
                <span>Já tem conta? <strong>← Fazer login</strong></span>
              )}
            </button>
          </div>

          <div className="mt-6 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700 font-medium text-center">
              🛡️ Seus dados são protegidos com criptografia SHA-256
            </p>
          </div>
        </div>
      </div>

      {/* Input de arquivo hidden */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

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

      {/* Notificação */}
      <NotificationBanner 
        notification={notification} 
        onClose={hideNotification} 
      />
    </>
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

// =================== HOOK PARA GERENCIAMENTO DE DADOS ===================
const useAssetData = () => {
  const { user } = useAuth();
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [floorsResult, assetsResult] = await Promise.all([
        DatabaseService.getFloors(user.id),
        DatabaseService.getAssets(user.id)
      ]);

      if (floorsResult.success) {
        setFloors(floorsResult.data || []);
      } else {
        showNotification('Erro ao carregar andares', 'error');
      }

      if (assetsResult.success) {
        setAssets(assetsResult.data || []);
      } else {
        showNotification('Erro ao carregar ativos', 'error');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      showNotification('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Utilitários
  const getFloorName = useCallback((floorId) => {
    const floor = floors.find(f => f.id == floorId);
    return floor ? floor.name : 'Andar não encontrado';
  }, [floors]);

  const getRoomName = useCallback((roomId) => {
    for (const floor of floors) {
      const room = floor.rooms?.find(r => r.id == roomId);
      if (room) return room.name;
    }
    return 'Sala não encontrada';
  }, [floors]);

  const getRoomsForFloor = useCallback((floorId) => {
    const floor = floors.find(f => f.id == floorId);
    return floor ? floor.rooms || [] : [];
  }, [floors]);

  const getDashboardStats = useCallback(() => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'Ativo').length;
    const maintenance = assets.filter(a => a.status === 'Manutenção').length;
    const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.value) || 0), 0);

    return { total, active, maintenance, totalValue };
  }, [assets]);

  // CRUD de Ativos
  const createAsset = useCallback(async (assetData) => {
    const validation = ValidationService.validateAsset(assetData);
    if (!validation.isValid) {
      showNotification(validation.errors.join(', '), 'error');
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.createAsset(assetData, user.id);
      if (result.success) {
        await loadData();
        showNotification('Ativo criado com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao criar ativo:', error);
      showNotification('Erro ao criar ativo', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  const updateAsset = useCallback(async (assetId, assetData) => {
    const validation = ValidationService.validateAsset(assetData);
    if (!validation.isValid) {
      showNotification(validation.errors.join(', '), 'error');
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.updateAsset(assetId, assetData, user.id);
      if (result.success) {
        await loadData();
        showNotification('Ativo atualizado com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar ativo:', error);
      showNotification('Erro ao atualizar ativo', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  const deleteAsset = useCallback(async (assetId, assetName) => {
    if (!confirm(`Tem certeza que deseja excluir o ativo "${assetName}"?`)) {
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.deleteAsset(assetId, user.id);
      if (result.success) {
        await loadData();
        showNotification('Ativo excluído com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao excluir ativo:', error);
      showNotification('Erro ao excluir ativo', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  // CRUD de Salas
  const createRoom = useCallback(async (roomData) => {
    if (!roomData.name || !roomData.floor_id) {
      showNotification('Nome e andar são obrigatórios', 'error');
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.createRoom(roomData, user.id);
      if (result.success) {
        await loadData();
        showNotification('Sala criada com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao criar sala:', error);
      showNotification('Erro ao criar sala', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  const updateRoom = useCallback(async (roomId, roomData) => {
    if (!roomData.name || !roomData.floor_id) {
      showNotification('Nome e andar são obrigatórios', 'error');
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.updateRoom(roomId, roomData, user.id);
      if (result.success) {
        await loadData();
        showNotification('Sala atualizada com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar sala:', error);
      showNotification('Erro ao atualizar sala', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  const deleteRoom = useCallback(async (roomId, roomName) => {
    if (!confirm(`Tem certeza que deseja excluir a sala "${roomName}"?`)) {
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.deleteRoom(roomId, user.id);
      if (result.success) {
        await loadData();
        showNotification('Sala excluída com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao excluir sala:', error);
      showNotification('Erro ao excluir sala', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  // CRUD de Andares
  const createFloor = useCallback(async (floorData) => {
    if (!floorData.name) {
      showNotification('Nome do andar é obrigatório', 'error');
      return { success: false };
    }

    setLoading(true);
    try {
      const result = await DatabaseService.createFloor(floorData, user.id);
      if (result.success) {
        await loadData();
        showNotification('Andar criado com sucesso!', 'success');
        return { success: true };
      } else {
        showNotification(result.error, 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro ao criar andar:', error);
      showNotification('Erro ao criar andar', 'error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, loadData, showNotification]);

  return {
    // Estado
    floors,
    assets,
    loading,
    
    // Utilitários
    getFloorName,
    getRoomName,
    getRoomsForFloor,
    getDashboardStats,
    
    // Ações
    loadData,
    createAsset,
    updateAsset,
    deleteAsset,
    createRoom,
    updateRoom,
    deleteRoom,
    createFloor
  };
};

// =================== COMPONENTE PRINCIPAL DO SISTEMA ===================
const AssetManagementSystem = () => {
  const { user, signOut } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const {
    floors,
    assets,
    loading,
    getFloorName,
    getRoomName,
    getRoomsForFloor,
    getDashboardStats,
    createAsset,
    updateAsset,
    deleteAsset,
    createRoom,
    updateRoom,
    deleteRoom,
    createFloor
  } = useAssetData();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modais
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);

  // Dados calculados
  const stats = useMemo(() => getDashboardStats(), [getDashboardStats]);
  
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           asset.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filterStatus || asset.status === filterStatus;
      const matchesCategory = !filterCategory || asset.category === filterCategory;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [assets, searchTerm, filterStatus, filterCategory]);

  const handleLogout = useCallback(async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      const result = await signOut();
      if (result.success) {
        showNotification('Logout realizado com sucesso!', 'success');
      }
    }
  }, [signOut, showNotification]);

  const handleEditAsset = useCallback((asset) => {
    setEditingAsset(asset);
    setShowAssetModal(true);
  }, []);

  const handleEditRoom = useCallback((room) => {
    setEditingRoom(room);
    setShowRoomModal(true);
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        {/* Header Moderno */}
        <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icons.Package />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                    {APP_CONFIG.APP_NAME}
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">
                    Sistema Inteligente de Controle de Ativos v{APP_CONFIG.VERSION}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="group flex items-center space-x-3 hover:bg-white/10 rounded-xl p-2 transition-all"
                >
                  {user?.photo ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg ring-2 ring-white group-hover:ring-blue-200 transition-all">
                      <img src={user.photo} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white group-hover:ring-blue-200 transition-all">
                      <Icons.User />
                    </div>
                  )}
                  
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    {user?.company && (
                      <p className="text-xs text-blue-600 font-medium">{user.company}</p>
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
        </header>

        {/* Navegação */}
        <nav className="bg-white/60 backdrop-blur-lg border-b border-white/20">
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
        </nav>

        {/* Conteúdo Principal */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {activeTab === 'profile' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-bold transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Voltar ao Dashboard</span>
                </button>
                
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                  👤 Perfil do Usuário
                </div>
              </div>
              
              <ProfilePage />
            </div>
          )}
          
          {activeTab === 'dashboard' && (
            <DashboardView stats={stats} assets={assets} />
          )}

          {activeTab === 'assets' && (
            <AssetsView
              assets={filteredAssets}
              totalAssets={assets.length}
              loading={loading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              onCreateAsset={() => setShowAssetModal(true)}
              onEditAsset={handleEditAsset}
              onDeleteAsset={deleteAsset}
              onViewAsset={setShowAssetDetail}
              getFloorName={getFloorName}
              getRoomName={getRoomName}
            />
          )}

          {activeTab === 'locations' && (
            <LocationsView
              floors={floors}
              loading={loading}
              onCreateFloor={() => setShowFloorModal(true)}
              onCreateRoom={() => setShowRoomModal(true)}
              onEditRoom={handleEditRoom}
              onDeleteRoom={deleteRoom}
            />
          )}
        </main>
      </div>

      {/* Modais */}
      {showAssetModal && (
        <AssetModal
          isOpen={showAssetModal}
          onClose={() => {
            setShowAssetModal(false);
            setEditingAsset(null);
          }}
          onSave={editingAsset ? updateAsset : createAsset}
          asset={editingAsset}
          floors={floors}
          getRoomsForFloor={getRoomsForFloor}
          loading={loading}
        />
      )}

      {showRoomModal && (
        <RoomModal
          isOpen={showRoomModal}
          onClose={() => {
            setShowRoomModal(false);
            setEditingRoom(null);
          }}
          onSave={editingRoom ? updateRoom : createRoom}
          room={editingRoom}
          floors={floors}
          loading={loading}
        />
      )}

      {showFloorModal && (
        <FloorModal
          isOpen={showFloorModal}
          onClose={() => setShowFloorModal(false)}
          onSave={createFloor}
          loading={loading}
        />
      )}

      {showAssetDetail && (
        <AssetDetailModal
          isOpen={!!showAssetDetail}
          onClose={() => setShowAssetDetail(null)}
          asset={showAssetDetail}
          onEdit={handleEditAsset}
          getFloorName={getFloorName}
          getRoomName={getRoomName}
        />
      )}

      {/* Notificação Global */}
      <NotificationBanner 
        notification={notification} 
        onClose={hideNotification} 
      />
    </>
  );
};

// =================== VIEWS DOS COMPONENTES ===================
const DashboardView = ({ stats, assets }) => (
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

    {/* Gráfico de Status */}
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Distribuição por Status</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {APP_CONFIG.STATUSES.map(status => {
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
);

// Continuando com os componentes AssetsView, LocationsView e ProfilePage...
const AssetsView = ({ 
  assets, 
  totalAssets, 
  loading, 
  searchTerm, 
  setSearchTerm,
  filterStatus, 
  setFilterStatus,
  filterCategory, 
  setFilterCategory,
  onCreateAsset,
  onEditAsset,
  onDeleteAsset,
  onViewAsset,
  getFloorName,
  getRoomName
}) => (
  <div className="space-y-8">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent mb-2">
          Gestão de Ativos
        </h2>
        <p className="text-gray-600 text-lg font-medium">Controle completo dos seus equipamentos e bens</p>
      </div>
      
      <button
        onClick={onCreateAsset}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
      >
        <Icons.Plus />
        <span>➕ Novo Ativo</span>
      </button>
    </div>

    {/* Filtros */}
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20">
      <h3 className="text-lg font-bold text-gray-900 mb-4">🔍 Filtros e Busca</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Buscar</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            placeholder="Nome ou código..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          >
            <option value="">Todos</option>
            {APP_CONFIG.STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Categoria</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          >
            <option value="">Todas</option>
            {APP_CONFIG.CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
    </div>

    {/* Lista de Ativos */}
    {loading ? (
      <div className="text-center py-20">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-gray-600 text-lg font-medium">Carregando ativos...</p>
      </div>
    ) : (
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-xl font-bold text-gray-900">
            📦 Seus Ativos ({assets.length} de {totalAssets})
          </h3>
        </div>
        
        {assets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Icons.Package />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {totalAssets === 0 ? 'Nenhum ativo cadastrado' : 'Nenhum ativo encontrado'}
            </h3>
            <p className="text-gray-600 mb-8">
              {totalAssets === 0 
                ? 'Comece criando seu primeiro ativo no sistema' 
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {totalAssets === 0 && (
              <button
                onClick={onCreateAsset}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                ➕ Criar Primeiro Ativo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-8">
            {assets.map(asset => (
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
                      onClick={() => onViewAsset(asset)}
                      className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors"
                      title="Ver detalhes"
                    >
                      <Icons.Eye />
                    </button>
                    <button
                      onClick={() => onEditAsset(asset)}
                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-xl transition-colors"
                      title="Editar"
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      onClick={() => onDeleteAsset(asset.id, asset.name)}
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
);

const LocationsView = ({ floors, loading, onCreateFloor, onCreateRoom, onEditRoom, onDeleteRoom }) => (
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
          onClick={onCreateFloor}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
        >
          <Icons.Plus />
          <span>🏢 Adicionar Andar</span>
        </button>
        
        <button
          onClick={onCreateRoom}
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
      
      {loading ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg font-medium">Carregando localizações...</p>
        </div>
      ) : floors.length === 0 ? (
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
                        
                        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditRoom(room)}
                            className="p-1 bg-white hover:bg-blue-100 text-blue-600 rounded transition-colors shadow-sm"
                            title="Editar sala"
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            onClick={() => onDeleteRoom(room.id, room.name)}
                            className="p-1 bg-white hover:bg-red-100 text-red-600 rounded transition-colors shadow-sm"
                            title="Excluir sala"
                          >
                            <Icons.Trash2 />
                          </button>
                        </div>
                        
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
);

// Placeholder para componentes de modal e perfil que seriam implementados
const ProfilePage = () => <div>Perfil do usuário (implementar)</div>;
const AssetModal = () => null;
const RoomModal = () => null; 
const FloorModal = () => null;
const AssetDetailModal = () => null;

// =================== COMPONENTE PRINCIPAL DA APLICAÇÃO ===================
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
            <p className="text-gray-800 text-xl font-bold">Conectando ao sistema...</p>
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
          {/* Background Elements */}
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
                {APP_CONFIG.APP_NAME}
              </h1>
              <p className="text-gray-700 text-xl font-medium mb-2">Sistema Profissional de Controle de Ativos</p>
              <p className="text-gray-600 font-medium">Versão {APP_CONFIG.VERSION}</p>
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
                      <Icons.Camera />
                    </div>
                    <div>
                      <p className="font-bold text-green-900">Fotos Inteligentes</p>
                      <p className="text-sm text-green-700">Capture fotos diretamente no sistema</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Icons.Building />
                    </div>
                    <div>
                      <p className="font-bold text-purple-900">Arquitetura Profissional</p>
                      <p className="text-sm text-purple-700">Sistema refatorado com melhores práticas</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white py-5 px-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                >
                  🚀 Acessar Sistema
                </button>

                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <Icons.CheckCircle />
                    <span className="text-green-700 font-bold">Sistema funcionando com NeonDB</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Sistema refatorado com as melhores práticas de desenvolvimento
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

  return <AssetManagementSystem />;
};

// =================== EXPORT PRINCIPAL ===================
const AppWithProvider = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

export default AppWithProvider;
