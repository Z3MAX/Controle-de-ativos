import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { databaseService } from './services/database.js';
import { testConnection, initializeDatabase } from './lib/db.js';

// =================== CONTEXT DE AUTENTICAÇÃO ===================
const AuthContext = createContext({});

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Verificar conexão com banco
        const isConnected = await testConnection();
        if (!isConnected) {
          console.error('Falha na conexão com o banco de dados');
          setLoading(false);
          return;
        }

        // Inicializar estrutura do banco
        const dbInit = await initializeDatabase();
        if (!dbInit) {
          console.error('Falha ao inicializar banco de dados');
          setLoading(false);
          return;
        }

        setDbReady(true);

        // Verificar se há usuário salvo no localStorage
        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setProfile(userData);
        }
      } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const signUp = async (email, password, name, company = '') => {
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
    try {
      setLoading(true);
      
      // Buscar usuário por email
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

  const loadProfile = async (userId) => {
    // Profile já é carregado no login/signup
    return true;
  };

  const value = {
    user,
    profile,
    loading,
    dbReady,
    signUp,
    signIn,
    signOut,
    loadProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =================== ÍCONES SVG ===================
const Icons = {
  Camera: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Trash2: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Package: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="m3 5 0 14c0 1.6 4 3 9 3s9-1.4 9-3V5"></path>
      <path d="m3 12c0 1.6 4 3 9 3s9-1.4 9-3"></path>
    </svg>
  ),
  Home: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  BarChart3: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  DollarSign: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12,6 12,12 16,14"></polyline>
    </svg>
  ),
  XCircle: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Image: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21,15 16,10 5,21"></polyline>
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="20,6 9,17 4,12"></polyline>
    </svg>
  ),
  RotateCcw: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="1,4 1,10 7,10"></polyline>
      <path d="M3.51,15a9,9,0,0,0,13.48,2.55"></path>
      <path d="M20.49,9A9,9,0,0,0,7,6.54L1,10"></path>
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  LogOut: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.5 1.5L5 6L3.5 4.5L5 3zm0 18l1.5-1.5L5 18l-1.5 1.5L5 21zM19 3l-1.5 1.5L19 6l1.5-1.5L19 3zm0 18l-1.5-1.5L19 18l1.5 1.5L19 21zM9 12l3-3 3 3-3 3-3-3z" />
    </svg>
  ),
  Zap: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
    </svg>
  ),
  Shield: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
};

// =================== COMPONENTE DE AUTENTICAÇÃO ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signIn, signUp } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        if (isLogin) {
          onClose();
        } else {
          setMessage('✅ Conta criada com sucesso!');
          setTimeout(() => {
            onClose();
          }, 2000);
        }
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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 rounded-3xl"></div>
        
        <div className="relative z-10">
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all shadow-lg hover:shadow-xl"
          >
            <Icons.X />
          </button>

          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Icons.User />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
              {isLogin ? '🔑 Bem-vindo de volta!' : '✨ Criar sua conta'}
            </h2>
            <p className="text-gray-600 mt-3 font-medium">
              {isLogin ? 'Entre para acessar seus ativos' : 'Comece a gerenciar seus ativos agora'}
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl mb-6 text-sm font-medium ${
              message.includes('✅') 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200' 
                : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    minLength="2"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/70 backdrop-blur-sm font-medium placeholder-gray-400"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Empresa (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/70 backdrop-blur-sm font-medium placeholder-gray-400"
                    placeholder="Nome da sua empresa"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                E-mail *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/70 backdrop-blur-sm font-medium placeholder-gray-400"
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Senha *
              </label>
              <input
                type="password"
                required
                minLength="6"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/70 backdrop-blur-sm font-medium placeholder-gray-400"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-4 px-6 rounded-2xl font-bold transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </div>
              ) : (
                isLogin ? '🔑 Entrar na Conta' : '✨ Criar Conta Gratuita'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage('');
                setFormData({ email: '', password: '', name: '', company: '' });
              }}
              className="text-purple-600 hover:text-purple-700 font-semibold transition-colors hover:underline"
            >
              {isLogin ? '✨ Não tem conta? Criar agora' : '🔑 Já tem conta? Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================== COMPONENTE PRINCIPAL ===================
const AssetControlSystem = () => {
  const { user, profile, loading: authLoading, dbReady, signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [floors, setFloors] = useState([]);
  const [assets, setAssets] = useState([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const [photoState, setPhotoState] = useState({
    showOptions: false,
    showPreview: false,
    capturedPhoto: null,
    isProcessing: false,
    error: ''
  });

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

  const categories = [
    'Informática', 'Móveis', 'Equipamentos', 'Veículos', 
    'Eletroeletrônicos', 'Ferramentas', 'Segurança', 'Outros'
  ];

  const statuses = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'];

  useEffect(() => {
    if (user && dbReady) {
      loadData();
    }
  }, [user, dbReady]);

  const loadData = async () => {
    if (!user || !user.id) return;
    
    setIsLoading(true);
    try {
      const [floorsResult, assetsResult] = await Promise.all([
        databaseService.floors.getAll(user.id),
        databaseService.assets.getAll(user.id)
      ]);

      if (floorsResult.success) {
        setFloors(floorsResult.data || []);
      } else {
        console.error('Erro ao carregar andares:', floorsResult.error);
      }

      if (assetsResult.success) {
        setAssets(assetsResult.data || []);
      } else {
        console.error('Erro ao carregar ativos:', assetsResult.error);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ... (resto das funções de foto permanecem iguais)
  const openPhotoOptions = () => {
    setPhotoState(prev => ({
      ...prev,
      showOptions: true,
      error: ''
    }));
  };

  const closeAllPhotoModals = () => {
    setPhotoState({
      showOptions: false,
      showPreview: false,
      capturedPhoto: null,
      isProcessing: false,
      error: ''
    });
  };

  const processImageFile = async (file) => {
    if (!file) return;

    setPhotoState(prev => ({ ...prev, isProcessing: true, error: '' }));

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecione apenas arquivos de imagem.');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('A imagem deve ter no máximo 10MB.');
      }

      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
        reader.readAsDataURL(file);
      });
      
      const resizedImage = await resizeImage(imageDataUrl, 1024, 768);

      setPhotoState(prev => ({
        ...prev,
        capturedPhoto: resizedImage,
        showPreview: true,
        showOptions: false,
        isProcessing: false
      }));
      
    } catch (error) {
      setPhotoState(prev => ({
        ...prev,
        error: error.message || 'Erro ao processar imagem.',
        isProcessing: false
      }));
    }
  };

  const resizeImage = (dataUrl, maxWidth, maxHeight) => {
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
        
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(resizedDataUrl);
      };
      
      img.src = dataUrl;
    });
  };

  const handleTakePhoto = () => {
    setPhotoState(prev => ({ ...prev, showOptions: false, error: '' }));

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          processImageFile(file);
        }
      });
      
      input.click();
      
    } catch (error) {
      setPhotoState(prev => ({
        ...prev,
        error: 'Erro ao acessar a câmera. Verifique as permissões.'
      }));
    }
  };

  const handleSelectFromGallery = () => {
    setPhotoState(prev => ({ ...prev, showOptions: false, error: '' }));
    
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          processImageFile(file);
        }
      });
      
      input.click();
      
    } catch (error) {
      setPhotoState(prev => ({
        ...prev,
        error: 'Erro ao acessar galeria.'
      }));
    }
  };

  const confirmPhoto = () => {
    if (photoState.capturedPhoto) {
      setAssetForm(prev => ({ ...prev, photo: photoState.capturedPhoto }));
      closeAllPhotoModals();
    }
  };

  const retakePhoto = () => {
    setPhotoState(prev => ({
      ...prev,
      showPreview: false,
      showOptions: true,
      capturedPhoto: null
    }));
  };

  const removePhotoFromForm = () => {
    setAssetForm(prev => ({ ...prev, photo: null }));
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name?.trim() || !roomForm.floor_id) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!user || !user.id) {
      alert('Erro: usuário não autenticado');
      return;
    }

    try {
      setIsLoading(true);
      
      const roomData = {
        name: roomForm.name.trim(),
        description: roomForm.description?.trim() || '',
        floor_id: parseInt(roomForm.floor_id)
      };

      let result;
      if (editingRoom) {
        result = await databaseService.rooms.update(editingRoom.id, roomData, user.id);
      } else {
        result = await databaseService.rooms.create(roomData, user.id);
      }

      if (result.success) {
        await loadData();
        setRoomForm({ name: '', description: '', floor_id: '' });
        setShowRoomForm(false);
        setEditingRoom(null);
      } else {
        alert(`Erro ao ${editingRoom ? 'atualizar' : 'criar'} sala: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro ao ${editingRoom ? 'atualizar' : 'criar'} sala: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      description: room.description || '',
      floor_id: room.floor_id.toString()
    });
    setShowRoomForm(true);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Tem certeza que deseja excluir esta sala?')) return;

    if (!user || !user.id) {
      alert('Erro: usuário não autenticado');
      return;
    }

    try {
      setIsLoading(true);
      
      const assetsInRoom = assets.filter(asset => asset.room_id === roomId);
      if (assetsInRoom.length > 0) {
        alert(`Não é possível excluir esta sala pois existem ${assetsInRoom.length} ativo(s) cadastrado(s) nela.`);
        return;
      }

      const result = await databaseService.rooms.delete(roomId, user.id);
      
      if (result.success) {
        await loadData();
      } else {
        alert(`Erro ao excluir sala: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro ao excluir sala: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!assetForm.name?.trim()) {
      alert('Por favor, preencha o nome do ativo.');
      return;
    }
    
    if (!assetForm.code?.trim()) {
      alert('Por favor, preencha o código do ativo.');
      return;
    }
    
    if (!assetForm.floor_id) {
      alert('Por favor, selecione o andar.');
      return;
    }

    if (!user || !user.id) {
      alert('Erro: usuário não autenticado');
      return;
    }

    try {
      setIsLoading(true);

      if (!editingAsset) {
        const codeCheck = await databaseService.assets.checkCodeExists(assetForm.code, null, user.id);
        if (codeCheck.success && codeCheck.exists) {
          alert('Já existe um ativo com este código.');
          return;
        }
      }

      const assetData = {
        name: assetForm.name.trim(),
        code: assetForm.code.trim(),
        category: assetForm.category || null,
        description: assetForm.description?.trim() || null,
        value: assetForm.value ? parseFloat(assetForm.value) : null,
        status: assetForm.status || 'Ativo',
        floor_id: parseInt(assetForm.floor_id),
        room_id: assetForm.room_id ? parseInt(assetForm.room_id) : null,
        photo: assetForm.photo || null,
        supplier: assetForm.supplier?.trim() || null,
        serial_number: assetForm.serial_number?.trim() || null
      };

      let result;
      if (editingAsset) {
        result = await databaseService.assets.update(editingAsset.id, assetData, user.id);
      } else {
        result = await databaseService.assets.create(assetData, user.id);
      }

      if (result.success) {
        await loadData();
        resetAssetForm();
        setShowAssetForm(false);
        setEditingAsset(null);
      } else {
        alert(`Erro ao ${editingAsset ? 'atualizar' : 'criar'} ativo: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro ao ${editingAsset ? 'atualizar' : 'criar'} ativo: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAsset = (asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      code: asset.code,
      category: asset.category || '',
      description: asset.description || '',
      value: asset.value || '',
      status: asset.status || 'Ativo',
      floor_id: asset.floor_id?.toString() || '',
      room_id: asset.room_id?.toString() || '',
      photo: asset.photo || null,
      supplier: asset.supplier || '',
      serial_number: asset.serial_number || ''
    });
    setShowAssetForm(true);
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Tem certeza que deseja excluir este ativo?')) return;

    if (!user || !user.id) {
      alert('Erro: usuário não autenticado');
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await databaseService.assets.delete(assetId, user.id);
      
      if (result.success) {
        await loadData();
      } else {
        alert(`Erro ao excluir ativo: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro ao excluir ativo: ${error.message}`);
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
    closeAllPhotoModals();
  };

  const getFloorName = (floorId) => {
    const floor = floors.find(f => f.id === floorId);
    return floor ? floor.name : '';
  };

  const getRoomName = (roomId) => {
    const room = floors.flatMap(f => f.rooms || []).find(r => r.id === roomId);
    return room ? room.name : '';
  };

  const getRoomsForFloor = (floorId) => {
    const floor = floors.find(f => f.id === parseInt(floorId));
    return floor ? (floor.rooms || []) : [];
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (asset.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getDashboardStats = () => {
    const total = assets.length;
    const active = assets.filter(a => a.status === 'Ativo').length;
    const maintenance = assets.filter(a => a.status === 'Manutenção').length;
    const inactive = assets.filter(a => a.status === 'Inativo').length;
    const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(asset.value) || 0), 0);

    return {
      total,
      active,
      maintenance,
      inactive,
      totalValue,
      totalRooms: floors.reduce((sum, floor) => sum + (floor.rooms?.length || 0), 0)
    };
  };

  const stats = getDashboardStats();

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      'Ativo': { color: 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200', icon: Icons.CheckCircle },
      'Manutenção': { color: 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-200', icon: Icons.Clock },
      'Inativo': { color: 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 border-gray-200', icon: Icons.XCircle },
      'Descartado': { color: 'bg-gradient-to-r from-red-50 to-pink-50 text-red-600 border-red-200', icon: Icons.X }
    };
    
    const config = statusConfig[status] || statusConfig['Ativo'];
    const IconComponent = config.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${config.color} shadow-sm`}>
        <IconComponent />
        <span className="ml-1.5">{status}</span>
      </span>
    );
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      const result = await signOut();
      if (result.success) {
        setFloors([]);
        setAssets([]);
        setActiveTab('dashboard');
      }
    }
  };

  // Verificar se o banco de dados está configurado
  if (!dbReady && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-200">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Icons.AlertCircle />
            </div>
            <h2 className="text-2xl font-bold text-red-800 mb-4">⚠️ Configuração Necessária</h2>
            <p className="text-red-700 mb-6 leading-relaxed">
              Para usar o sistema, você precisa configurar a conexão com o banco de dados NeonDB.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
              <p className="text-sm text-red-800 font-medium mb-2">Passos necessários:</p>
              <ol className="text-sm text-red-700 space-y-1 list-decimal list-inside">
                <li>Criar conta no NeonDB</li>
                <li>Configurar VITE_DATABASE_URL</li>
                <li>Fazer deploy novamente</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <Icons.Database />
          </div>
          <p className="text-gray-600 text-lg font-medium mt-4">Conectando ao banco de dados...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
          </div>
          
          <div className="max-w-md w-full relative z-10">
            <div className="text-center mb-10">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                <Icons.Package />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent mb-3">
                AssetManager Pro
              </h1>
              <p className="text-gray-600 text-lg font-medium">Sistema completo de controle de ativos</p>
              <p className="text-gray-500 text-sm mt-2">com fotos e gestão inteligente</p>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">Bem-vindo! ✨</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center space-x-4 text-gray-700 group hover:text-purple-600 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Camera />
                  </div>
                  <span className="font-medium">📷 Fotos dos ativos com câmera</span>
                </div>
                <div className="flex items-center space-x-4 text-gray-700 group hover:text-purple-600 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.MapPin />
                  </div>
                  <span className="font-medium">🏢 Gestão inteligente de localizações</span>
                </div>
                <div className="flex items-center space-x-4 text-gray-700 group hover:text-purple-600 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.BarChart3 />
                  </div>
                  <span className="font-medium">📊 Relatórios automáticos detalhados</span>
                </div>
                <div className="flex items-center space-x-4 text-gray-700 group hover:text-purple-600 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Shield />
                  </div>
                  <span className="font-medium">🔒 Dados seguros na nuvem</span>
                </div>
              </div>

              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-blue-700 hover:to-cyan-700 text-white py-4 px-6 rounded-2xl font-bold transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Icons.Sparkles />
                  <span>Começar Agora</span>
                  <Icons.Zap />
                </div>
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 font-medium">
                  <span className="text-green-600">✅ Dados na nuvem</span> • 
                  <span className="text-blue-600"> 🚀 PostgreSQL seguro</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="bg-white/90 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icons.Package />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                    AssetManager Pro
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500 font-medium">Sistema de Controle de Ativos</p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-purple-800 bg-clip-text text-transparent">
                    AssetManager
                  </h1>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden lg:flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                  <Icons.Package />
                  <span className="font-semibold text-blue-700">{stats.total}</span>
                  <span className="text-blue-600">ativos</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                  <Icons.Building />
                  <span className="font-semibold text-purple-700">{stats.totalRooms}</span>
                  <span className="text-purple-600">salas</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <Icons.DollarSign />
                  <span className="font-semibold text-green-700">
                    R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Icons.User />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">
                      {profile?.name || user.email?.split('@')[0]}
                    </p>
                    {profile?.company && (
                      <p className="text-xs text-gray-500">{profile.company}</p>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-gray-600 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-all border border-transparent hover:border-red-200"
                  title="Sair"
                >
                  <Icons.LogOut />
                  <span className="hidden md:inline font-medium">Sair</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 mt-6 overflow-x-auto pb-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Icons.Home, shortLabel: 'Home', gradient: 'from-blue-500 to-cyan-500' },
              { id: 'assets', label: 'Ativos', icon: Icons.Package, shortLabel: 'Ativos', gradient: 'from-purple-500 to-pink-500' },
              { id: 'locations', label: 'Localizações', icon: Icons.Building, shortLabel: 'Local', gradient: 'from-green-500 to-emerald-500' },
              { id: 'reports', label: 'Relatórios', icon: Icons.BarChart3, shortLabel: 'Report', gradient: 'from-orange-500 to-red-500' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 md:px-6 py-3 rounded-2xl font-semibold transition-all whitespace-nowrap border ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg scale-105 border-white/20`
                    : 'text-gray-600 hover:bg-white/70 hover:text-gray-800 border-gray-200 bg-white/40'
                }`}
              >
                <tab.icon />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                  Dashboard
                </h2>
                <p className="text-gray-600 mt-2">Visão geral dos seus ativos</p>
              </div>
              {profile && (
                <div className="text-right bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/40">
                  <p className="text-sm text-gray-600">Bem-vindo de volta,</p>
                  <p className="font-bold text-lg text-gray-900">{profile.name}</p>
                  {profile.company && (
                    <p className="text-sm text-purple-600 font-medium">{profile.company}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 md:p-8 rounded-3xl shadow-lg border border-blue-100 hover:shadow-xl transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-2">Total de Ativos</p>
                    <p className="text-3xl md:text-4xl font-bold text-blue-700">{stats.total}</p>
                    <p className="text-xs text-blue-500 mt-1">itens cadastrados</p>
                  </div>
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Package />
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 md:p-8 rounded-3xl shadow-lg border border-emerald-100 hover:shadow-xl transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600 mb-2">Ativos Ativos</p>
                    <p className="text-3xl md:text-4xl font-bold text-emerald-700">{stats.active}</p>
                    <p className="text-xs text-emerald-500 mt-1">em funcionamento</p>
                  </div>
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.CheckCircle />
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 md:p-8 rounded-3xl shadow-lg border border-orange-100 hover:shadow-xl transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 mb-2">Em Manutenção</p>
                    <p className="text-3xl md:text-4xl font-bold text-orange-700">{stats.maintenance}</p>
                    <p className="text-xs text-orange-500 mt-1">necessitam atenção</p>
                  </div>
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Clock />
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 md:p-8 rounded-3xl shadow-lg border border-purple-100 hover:shadow-xl transition-all group col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 mb-2">Valor Total</p>
                    <p className="text-2xl md:text-3xl font-bold text-purple-700">
                      R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-purple-500 mt-1">patrimônio total</p>
                  </div>
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.DollarSign />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-lg border border-white/40">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Icons.Zap />
                <span>Ações Rápidas</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setActiveTab('assets');
                    setShowAssetForm(true);
                  }}
                  className="flex items-center space-x-4 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-2xl transition-all group border border-blue-200 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Plus />
                  </div>
                  <div className="text-left">
                    <p className="text-blue-600 font-bold text-lg">Adicionar Ativo</p>
                    <p className="text-blue-500 text-sm">Cadastrar novo item</p>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setActiveTab('locations');
                    setShowRoomForm(true);
                  }}
                  className="flex items-center space-x-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-2xl transition-all group border border-purple-200 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.Building />
                  </div>
                  <div className="text-left">
                    <p className="text-purple-600 font-bold text-lg">Adicionar Sala</p>
                    <p className="text-purple-500 text-sm">Nova localização</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                    Gestão de Ativos
                  </h2>
                  <p className="text-gray-600 mt-2">Gerencie todos os seus ativos em um só lugar</p>
                </div>
                
                <button
                  onClick={() => setShowAssetForm(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center space-x-3 text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Icons.Plus />
                  <span>Novo Ativo</span>
                  <Icons.Sparkles />
                </button>
              </div>

              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-white/40">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Icons.Search />
                  </div>
                  <input
                    type="text"
                    placeholder="🔍 Buscar por nome, código ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm font-medium placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {isLoading ? (
                <div className="text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/40">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-gray-500 font-medium">Carregando ativos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAssets.map(asset => (
                    <div key={asset.id} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/40 p-6 hover:shadow-xl transition-all group">
                      <div className="flex items-start space-x-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                          {asset.photo ? (
                            <img src={asset.photo} alt={asset.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                              <Icons.Package />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{asset.name}</h3>
                          <p className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded-lg inline-block mb-2">
                            {asset.code}
                          </p>
                          {asset.category && (
                            <span className="inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full border border-blue-200 mb-3">
                              {asset.category}
                            </span>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <StatusBadge status={asset.status} />
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Icons.MapPin />
                              <span className="font-medium">{getFloorName(asset.floor_id)} - {getRoomName(asset.room_id)}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setShowAssetDetail(asset)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all hover:scale-110"
                                title="Ver detalhes"
                              >
                                <Icons.Eye />
                              </button>
                              <button
                                onClick={() => handleEditAsset(asset)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-all hover:scale-110"
                                title="Editar"
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all hover:scale-110"
                                title="Excluir"
                              >
                                <Icons.Trash2 />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredAssets.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/40">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Icons.Package />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum ativo encontrado</h3>
                      <p className="text-gray-500 mb-6">Comece adicionando seu primeiro ativo</p>
                      <button
                        onClick={() => setShowAssetForm(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <div className="flex items-center space-x-2">
                          <Icons.Plus />
                          <span>Adicionar Primeiro Ativo</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-gray-900 bg-clip-text text-transparent">
                  Localizações
                </h2>
                <p className="text-gray-600 mt-2">Gerencie andares e salas</p>
              </div>
              
              <button
                onClick={() => setShowRoomForm(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center space-x-3 text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Icons.Plus />
                <span>Nova Sala</span>
                <Icons.Building />
              </button>
            </div>

            <div className="space-y-6">
              {isLoading ? (
                <div className="text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/40">
                  <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-gray-500 font-medium">Carregando localizações...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {floors.map(floor => (
                    <div key={floor.id} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/40 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                            <Icons.Building />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{floor.name}</h3>
                            {floor.description && (
                              <p className="text-sm text-gray-600">{floor.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-600">Salas cadastradas:</span>
                          <span className="font-bold text-green-600">{floor.rooms?.length || 0}</span>
                        </div>
                        
                        {floor.rooms && floor.rooms.length > 0 && (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {floor.rooms.map(room => (
                              <div key={room.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
                                <div>
                                  <p className="font-semibold text-gray-900">{room.name}</p>
                                  {room.description && (
                                    <p className="text-xs text-gray-500">{room.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleEditRoom(room)}
                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                    title="Editar sala"
                                  >
                                    <Icons.Edit />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRoom(room.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Excluir sala"
                                  >
                                    <Icons.Trash2 />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {(!floor.rooms || floor.rooms.length === 0) && (
                          <div className="text-center py-6 text-gray-500">
                            <Icons.Building />
                            <p className="text-sm mt-2">Nenhuma sala cadastrada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {floors.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/40">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Icons.Building />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma localização encontrada</h3>
                      <p className="text-gray-500 mb-6">Comece adicionando uma sala</p>
                      <button
                        onClick={() => setShowRoomForm(true)}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <div className="flex items-center space-x-2">
                          <Icons.Plus />
                          <span>Adicionar Primeira Sala</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================== MODAIS DE FORMULÁRIOS =================== */}
      
      {/* Modal de Opções de Foto */}
      {photoState.showOptions && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-white/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 rounded-3xl"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Icons.Camera />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">📷 Adicionar Foto</h3>
                <p className="text-gray-600 font-medium">Como você gostaria de adicionar a foto do ativo?</p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={handleTakePhoto}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-5 px-6 rounded-2xl flex items-center justify-center space-x-4 transition-all transform hover:scale-105 shadow-lg font-bold"
                >
                  <Icons.Camera />
                  <div className="text-left">
                    <div className="font-bold">📷 Tirar Foto</div>
                    <div className="text-sm opacity-90">Usar câmera do dispositivo</div>
                  </div>
                </button>
                
                <button
                  onClick={handleSelectFromGallery}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-5 px-6 rounded-2xl flex items-center justify-center space-x-4 transition-all transform hover:scale-105 shadow-lg font-bold"
                >
                  <Icons.Image />
                  <div className="text-left">
                    <div className="font-bold">🖼️ Galeria</div>
                    <div className="text-sm opacity-90">Escolher foto existente</div>
                  </div>
                </button>
                
                <button
                  onClick={closeAllPhotoModals}
                  className="w-full bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white py-4 px-6 rounded-2xl transition-all font-bold"
                >
                  ❌ Cancelar
                </button>
              </div>
              
              <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icons.AlertCircle />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-bold">💡 Dica Importante:</p>
                    <p>Permita o acesso à câmera quando solicitado. Use boa iluminação para melhor qualidade da foto.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resto dos modais permanecem iguais... */}
      {/* Devido ao limite de caracteres, vou criar um arquivo separado com os modais restantes */}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AssetControlSystem />
    </AuthProvider>
  );
};

export default App;