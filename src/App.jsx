import React, { useState, useEffect, createContext, useContext } from 'react';

// =================== CONTEXT DE AUTENTICAÇÃO ===================
const AuthContext = createContext({});

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// =================== SERVIÇOS REAIS DO BANCO ===================
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

      // Criar tabela de usuários
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

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

      console.log('✅ Banco de dados inicializado');
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
        const result = await sql`
          INSERT INTO users (email, name, company)
          VALUES (${userData.email}, ${userData.name}, ${userData.company || null})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async findByEmail(email) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`
          SELECT * FROM users WHERE email = ${email} LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
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
    }
  }
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // OBRIGATÓRIO: Verificar conexão com banco
        const isConnected = await databaseService.testConnection();
        if (!isConnected) {
          setConnectionError('Falha na conexão com banco de dados NeonDB');
          setLoading(false);
          return;
        }

        // Inicializar estrutura do banco
        const dbInit = await databaseService.initializeDatabase();
        if (!dbInit) {
          setConnectionError('Falha ao inicializar estrutura do banco');
          setLoading(false);
          return;
        }

        setDbReady(true);
        setConnectionError(null);

        // Verificar se há usuário válido salvo
        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            // Verificar se usuário ainda existe no banco
            const userCheck = await databaseService.users.findByEmail(userData.email);
            if (userCheck.success && userCheck.data) {
              setUser(userCheck.data);
              setProfile(userCheck.data);
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

  const signUp = async (email, password, name, company = '') => {
    if (!dbReady) {
      return { success: false, error: 'Banco de dados não disponível' };
    }

    try {
      setLoading(true);
      
      // Verificar se usuário já existe
      const existingUser = await databaseService.users.findByEmail(email);
      if (existingUser.success && existingUser.data) {
        return { success: false, error: 'Usuário já existe com este e-mail' };
      }

      // Criar novo usuário
      const result = await databaseService.users.create({
        email,
        name,
        company
      });

      if (result.success) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
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
      
      // Buscar usuário real no banco
      const result = await databaseService.users.findByEmail(email);
      
      if (result.success && result.data) {
        const userData = result.data;
        setUser(userData);
        setProfile(userData);
        localStorage.setItem('asset_manager_user', JSON.stringify(userData));
        
        return { success: true, data: { user: userData } };
      } else {
        return { success: false, error: 'Usuário não encontrado' };
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

  const value = {
    user,
    profile,
    loading,
    dbReady,
    connectionError,
    signUp,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =================== ÍCONES ===================
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
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
  )
};

// =================== MODAL DE AUTENTICAÇÃO ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signIn, signUp, dbReady } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

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
        if (formData.name.length < 2) {
          setMessage('❌ Nome deve ter pelo menos 2 caracteres');
          return;
        }
        result = await signUp(formData.email, formData.password, formData.name, formData.company);
      }

      if (result.success) {
        setMessage('✅ ' + (isLogin ? 'Login realizado!' : 'Conta criada!'));
        setTimeout(() => {
          onClose();
          // Usuário será redirecionado automaticamente para o sistema
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
        >
          <Icons.X />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.User />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Acesse sua conta' : 'Crie sua conta com NeonDB'}
          </p>
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
          </div>

          <button
            type="submit"
            disabled={loading || !dbReady}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage('');
              setFormData({ email: '', password: '', name: '', company: '' });
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {isLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =================== SISTEMA DE CONTROLE DE ATIVOS ===================
const AssetControlSystem = () => {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    value: '',
    status: 'Ativo'
  });

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

  const handleCreateAsset = async () => {
    if (!newAsset.name || !newAsset.code) {
      alert('Nome e código são obrigatórios');
      return;
    }

    try {
      setIsLoading(true);
      const result = await databaseService.assets.create(newAsset, user.id);
      
      if (result.success) {
        await loadData();
        setNewAsset({
          name: '',
          code: '',
          category: '',
          description: '',
          value: '',
          status: 'Ativo'
        });
        setShowAssetForm(false);
      } else {
        alert('Erro ao criar ativo: ' + result.error);
      }
    } catch (error) {
      alert('Erro ao criar ativo: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      await signOut();
    }
  };

  const getDashboardStats = () => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'Ativo').length;
    const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.value) || 0), 0);

    return { total, active, totalValue };
  };

  const stats = getDashboardStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Icons.Package />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AssetManager Pro</h1>
                <p className="text-sm text-gray-500">Sistema de Controle de Ativos</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
              </div>
              
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Icons.BarChart3 },
              { id: 'assets', label: 'Ativos', icon: Icons.Package },
              { id: 'locations', label: 'Localizações', icon: Icons.Building }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
              <p className="text-gray-600">Visão geral dos seus ativos</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icons.Package />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total de Ativos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icons.CheckCircle />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Ativos Ativos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 font-bold">R$</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Valor Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {stats.totalValue.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestão de Ativos</h2>
                <p className="text-gray-600">Gerencie todos os seus ativos</p>
              </div>
              
              <button
                onClick={() => setShowAssetForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-medium"
              >
                <Icons.Plus />
                <span>Novo Ativo</span>
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Carregando ativos...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Seus Ativos ({assets.length})
                  </h3>
                </div>
                
                {assets.length === 0 ? (
                  <div className="text-center py-12">
                    <Icons.Package />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum ativo</h3>
                    <p className="mt-1 text-sm text-gray-500">Comece criando seu primeiro ativo</p>
                    <div className="mt-6">
                      <button
                        onClick={() => setShowAssetForm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                      >
                        Criar Primeiro Ativo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {assets.map(asset => (
                      <div key={asset.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{asset.name}</h4>
                            <p className="text-sm text-gray-500">Código: {asset.code}</p>
                            <p className="text-sm text-gray-500">Status: {asset.status}</p>
                          </div>
                          <div className="text-right">
                            {asset.value && (
                              <p className="text-sm font-medium text-gray-900">
                                R$ {parseFloat(asset.value).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2
                                })}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                            </p>
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
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Localizações</h2>
              <p className="text-gray-600">Gerencie andares e salas</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Andares ({floors.length})
              </h3>
              
              {floors.length === 0 ? (
                <div className="text-center py-8">
                  <Icons.Building />
                  <p className="mt-2 text-sm text-gray-500">Nenhum andar cadastrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {floors.map(floor => (
                    <div key={floor.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{floor.name}</h4>
                      <p className="text-sm text-gray-500">{floor.description}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {floor.rooms?.length || 0} sala(s)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Novo Ativo */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Novo Ativo</h3>
              <button
                onClick={() => setShowAssetForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do ativo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={newAsset.code}
                  onChange={(e) => setNewAsset({...newAsset, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Código único"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  value={newAsset.category}
                  onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Informática"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newAsset.value}
                  onChange={(e) => setNewAsset({...newAsset, value: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({...newAsset, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição do ativo"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAssetForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAsset}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Criando...' : 'Criar Ativo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =================== COMPONENTE PRINCIPAL ===================
const App = () => {
  const { user, loading, dbReady, connectionError } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Icons.Package />
          </div>
          <p className="text-gray-600 text-lg">Conectando ao NeonDB...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl text-center">
          <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.AlertCircle />
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">Erro de Conexão</h2>
          <p className="text-red-600 mb-4">{connectionError}</p>
          <p className="text-sm text-gray-600">
            Verifique se a variável VITE_DATABASE_URL está configurada corretamente.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Icons.Package />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                AssetManager Pro
              </h1>
              <p className="text-gray-600 text-lg">Sistema de controle de ativos</p>
              <p className="text-gray-500 text-sm mt-2">Conectado ao NeonDB PostgreSQL</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-8 border">
              <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">Bem-vindo!</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-3 text-gray-700">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icons.CheckCircle />
                  </div>
                  <span>Gestão completa de ativos</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icons.CheckCircle />
                  </div>
                  <span>Banco PostgreSQL na nuvem</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Icons.CheckCircle />
                  </div>
                  <span>Dados seguros e persistentes</span>
                </div>
              </div>

              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-bold transition-colors shadow-lg"
              >
                Acessar Sistema
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  ✅ Conexão com NeonDB estabelecida
                </p>
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
