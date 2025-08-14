import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import * as XLSX from 'xlsx';
import { neon } from '@neondatabase/serverless';

// =================== AUTH CONTEXT ===================
const AuthContext = createContext({});
const useAuth = () => useContext(AuthContext);

// =================== CRYPTO UTILITIES ===================
const CryptoUtils = {
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }
};

// =================== DATABASE SERVICE ===================
const databaseService = {
  async getConnection() {
    if (!import.meta.env.VITE_DATABASE_URL) throw new Error('VITE_DATABASE_URL não configurada');
    return neon(import.meta.env.VITE_DATABASE_URL);
  },

  async testConnection() {
    try {
      const sql = await this.getConnection();
      const result = await sql`SELECT NOW() as current_time`;
      console.log('✅ Conexão Neon estabelecida:', result[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Falha na conexão Neon:', error.message);
      return false;
    }
  },

  async initializeDatabase() {
    try {
      const sql = await this.getConnection();
      
      await sql`CREATE TABLE IF NOT EXISTS teams (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, password_hash VARCHAR(255), company VARCHAR(255), photo TEXT, team_id INTEGER REFERENCES teams(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`CREATE TABLE IF NOT EXISTS floors (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE, team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`CREATE TABLE IF NOT EXISTS assets (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(100) NOT NULL, category VARCHAR(100), description TEXT, value DECIMAL(12,2), status VARCHAR(50) DEFAULT 'Ativo', floor_id INTEGER REFERENCES floors(id), room_id INTEGER REFERENCES rooms(id), photo TEXT, supplier VARCHAR(255), serial_number VARCHAR(255), team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(code, team_id))`;

      const existingTeams = await sql`SELECT COUNT(*) as count FROM teams`;
      if (parseInt(existingTeams[0].count) === 0) {
        const defaultTeams = [
          { name: 'TI', description: 'Tecnologia da Informação' },
          { name: 'Facilities', description: 'Facilities e Infraestrutura' },
          { name: 'Administrativo', description: 'Administrativo e Financeiro' }
        ];
        for (const team of defaultTeams) {
          await sql`INSERT INTO teams (name, description) VALUES (${team.name}, ${team.description})`;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      throw error;
    }
  },

  teams: {
    async getAll() {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT * FROM teams ORDER BY name`;
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  users: {
    async create(userData) {
      try {
        const sql = await databaseService.getConnection();
        const passwordHash = await CryptoUtils.hashPassword(userData.password);
        const result = await sql`INSERT INTO users (email, name, password_hash, company, photo, team_id) VALUES (${userData.email}, ${userData.name}, ${passwordHash}, ${userData.company || null}, ${userData.photo || null}, ${userData.team_id || null}) RETURNING id, email, name, company, photo, team_id, created_at, updated_at`;
        return { success: true, data: result[0] };
      } catch (error) {
        return { success: false, error: error.message.includes('unique') ? 'E-mail já em uso' : error.message };
      }
    },

    async authenticate(email, password) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT u.*, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.email = ${email} LIMIT 1`;
        if (result.length === 0) return { success: false, error: 'E-mail não encontrado' };
        
        const user = result[0];
        if (user.password_hash) {
          const isValid = await CryptoUtils.verifyPassword(password, user.password_hash);
          if (!isValid) return { success: false, error: 'Senha incorreta' };
        }
        
        const { password_hash, ...userWithoutPassword } = user;
        return { success: true, data: userWithoutPassword };
      } catch (error) {
        return { success: false, error: 'Erro na autenticação' };
      }
    },

    async findByEmail(email) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT u.*, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.email = ${email} LIMIT 1`;
        return { success: true, data: result[0] || null };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  floors: {
    async getAll(teamId) {
      try {
        const sql = await databaseService.getConnection();
        const floors = await sql`SELECT * FROM floors WHERE team_id = ${teamId} ORDER BY name`;
        for (let floor of floors) {
          const rooms = await sql`SELECT * FROM rooms WHERE floor_id = ${floor.id} ORDER BY name`;
          floor.rooms = rooms;
        }
        return { success: true, data: floors };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async create(floorData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`INSERT INTO floors (name, description, team_id) VALUES (${floorData.name}, ${floorData.description || null}, ${teamId}) RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  rooms: {
    async create(roomData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`INSERT INTO rooms (name, description, floor_id, team_id) VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${teamId}) RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  assets: {
    async getAll(teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT * FROM assets WHERE team_id = ${teamId} ORDER BY created_at DESC`;
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async create(assetData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`INSERT INTO assets (name, code, category, description, value, status, floor_id, room_id, photo, supplier, serial_number, team_id) VALUES (${assetData.name}, ${assetData.code}, ${assetData.category || null}, ${assetData.description || null}, ${assetData.value || null}, ${assetData.status}, ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null}, ${assetData.supplier || null}, ${assetData.serial_number || null}, ${teamId}) RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`UPDATE assets SET name = ${updates.name}, code = ${updates.code}, category = ${updates.category || null}, description = ${updates.description || null}, value = ${updates.value || null}, status = ${updates.status}, floor_id = ${updates.floor_id}, room_id = ${updates.room_id || null}, photo = ${updates.photo || null}, supplier = ${updates.supplier || null}, serial_number = ${updates.serial_number || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} AND team_id = ${teamId} RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await databaseService.getConnection();
        await sql`DELETE FROM assets WHERE id = ${id} AND team_id = ${teamId}`;
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
};

// =================== ICONS ===================
const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Package: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Filter: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Camera: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  BarChart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  DollarSign: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  MapPin: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  TrendingUp: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>,
  Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="m12 1 1.68 3.28L16.4 3.4l.88 3.53L21 8.12v3.54l-2.72 1.19L18.4 16.4l-3.28.88-1.19 2.72h-3.54l-1.19-2.72L5.6 16.4l-.88-3.53L1 15.88v-3.54l2.72-1.19L3.6 7.6l3.28-.88L8.12 4H11.88z"></path></svg>
};

// =================== LOADING COMPONENT ===================
const LoadingSpinner = ({ size = 'md', text = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClasses[size]} border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4`}></div>
      {text && <p className="text-gray-600 font-medium">{text}</p>}
    </div>
  );
};

// =================== STATUS BADGE COMPONENT ===================
const StatusBadge = ({ status }) => {
  const variants = {
    'Ativo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Inativo': 'bg-gray-100 text-gray-800 border-gray-200',
    'Manutenção': 'bg-amber-100 text-amber-800 border-amber-200',
    'Descartado': 'bg-red-100 text-red-800 border-red-200'
  };

  const icons = {
    'Ativo': '✅',
    'Inativo': '⏸️',
    'Manutenção': '🔧',
    'Descartado': '🗑️'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${variants[status] || variants.Inativo}`}>
      <span>{icons[status] || '❓'}</span>
      {status}
    </span>
  );
};

// =================== ASSET CARD COMPONENT ===================
const AssetCard = ({ asset, onView, onEdit, onDelete, getFloorName }) => {
  return (
    <div className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border border-gray-100 hover:border-blue-200">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {asset.name}
          </h3>
          <p className="text-sm font-mono bg-gray-100 text-gray-700 px-3 py-1 rounded-lg mt-2 inline-block">
            {asset.code}
          </p>
        </div>
        <StatusBadge status={asset.status} />
      </div>

      {/* Photo */}
      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4 overflow-hidden relative group/photo">
        {asset.photo ? (
          <img 
            src={asset.photo} 
            alt={asset.name} 
            className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="text-center">
              <Icons.Package />
              <p className="text-xs text-gray-500 mt-1">Sem foto</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button 
            onClick={() => onView(asset)}
            className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors"
          >
            Ver detalhes
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-3 mb-6">
        {asset.category && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
            <span className="text-gray-600">{asset.category}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm">
          <Icons.MapPin />
          <span className="text-gray-600">{getFloorName(asset.floor_id)}</span>
        </div>

        {asset.value && (
          <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
            <Icons.DollarSign />
            <span>R$ {parseFloat(asset.value).toLocaleString('pt-BR')}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onView(asset)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Icons.Eye />
          Ver
        </button>
        <button
          onClick={() => onEdit(asset)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Icons.Edit />
          Editar
        </button>
        <button
          onClick={() => onDelete(asset)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl transition-colors"
        >
          <Icons.Trash />
        </button>
      </div>
    </div>
  );
};

// =================== AUTH MODAL ===================
const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [teams, setTeams] = useState([]);
  const { signIn, signUp } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: '',
    team_id: ''
  });

  useEffect(() => {
    if (!isLogin) {
      databaseService.teams.getAll().then(result => {
        if (result.success) setTeams(result.data);
      });
    }
  }, [isLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = isLogin ? 
      await signIn(formData.email, formData.password) :
      await signUp(formData.email, formData.password, formData.name, formData.company, null, formData.team_id);

    if (result.success) {
      setMessage(`✅ ${isLogin ? 'Login realizado!' : 'Conta criada!'}`);
      setTimeout(onClose, 1500);
    } else {
      setMessage(`❌ ${result.error}`);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/80 via-purple-900/80 to-indigo-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.User />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Acesse sua conta' : 'Crie sua conta gratuita'}
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-medium ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Empresa (opcional)</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                  placeholder="Nome da sua empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Time</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({...formData, team_id: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                >
                  <option value="">Selecione um time</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">E-mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Senha</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processando...</span>
              </div>
            ) : (
              isLogin ? '🚀 Entrar' : '✨ Criar Conta'
            )}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-700 font-bold text-sm transition-colors"
            >
              {isLogin ? '✨ Criar nova conta' : '🔑 Já tenho conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =================== AUTH PROVIDER ===================
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  const createDefaultFloors = async (teamId) => {
    if (!teamId) return;
    
    try {
      const existingFloors = await databaseService.floors.getAll(teamId);
      if (!existingFloors.success || existingFloors.data.length > 0) return;

      const defaultFloors = [
        { name: '5º Andar', description: 'Administrativo' },
        { name: '11º Andar', description: 'Tecnologia' },
        { name: '15º Andar', description: 'Diretoria' }
      ];

      for (const floorData of defaultFloors) {
        const result = await databaseService.floors.create(floorData, teamId);
        if (result.success) {
          const rooms = floorData.name.includes('5') ? 
            [{ name: 'Financeiro' }, { name: 'RH' }] :
            floorData.name.includes('11') ? 
            [{ name: 'Desenvolvimento' }, { name: 'Testes' }] :
            [{ name: 'Diretoria' }, { name: 'Executiva' }];
          
          for (const roomData of rooms) {
            await databaseService.rooms.create({ ...roomData, floor_id: result.data.id }, teamId);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao criar andares padrão:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (!import.meta.env.VITE_DATABASE_URL) {
          setConnectionError('VITE_DATABASE_URL não configurada. Configure no Netlify em Environment Variables.');
          setLoading(false);
          return;
        }

        const connected = await databaseService.testConnection();
        if (!connected) {
          setConnectionError('Falha na conexão com Neon Database. Verifique se a connection string está correta.');
          setLoading(false);
          return;
        }

        await databaseService.initializeDatabase();

        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            const userCheck = await databaseService.users.findByEmail(userData.email);
            
            if (userCheck.success && userCheck.data) {
              setUser(userCheck.data);
              await createDefaultFloors(userCheck.data.team_id);
            } else {
              localStorage.removeItem('asset_manager_user');
            }
          } catch (error) {
            localStorage.removeItem('asset_manager_user');
          }
        }
      } catch (error) {
        setConnectionError(`Erro na inicialização: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const signUp = async (email, password, name, company = '', photo = null, team_id = null) => {
    try {
      const result = await databaseService.users.create({ 
        email, 
        password, 
        name, 
        company, 
        photo, 
        team_id: team_id || null 
      });
      
      if (result.success) {
        setUser(result.data);
        localStorage.setItem('asset_manager_user', JSON.stringify(result.data));
        await createDefaultFloors(result.data.team_id);
        return result;
      } else {
        return result;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      const result = await databaseService.users.authenticate(email, password);
      
      if (result.success) {
        setUser(result.data);
        localStorage.setItem('asset_manager_user', JSON.stringify(result.data));
        await createDefaultFloors(result.data.team_id);
      }
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('asset_manager_user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      connectionError, 
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// =================== MAIN APP COMPONENT ===================
const App = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState([]);
  const [floors, setFloors] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    value: '',
    status: 'Ativo',
    floor_id: '',
    room_id: '',
    photo: '',
    supplier: '',
    serial_number: ''
  });

  const categories = ['Informática', 'Móveis', 'Equipamentos', 'Veículos', 'Eletrônicos', 'Outros'];
  const statuses = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'];

  // Load data
  useEffect(() => {
    if (user?.team_id) {
      loadAssets();
      loadFloors();
    }
  }, [user]);

  // Filter assets
  useEffect(() => {
    let filtered = assets;
    
    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedFloor) filtered = filtered.filter(a => a.floor_id == selectedFloor);
    if (selectedCategory) filtered = filtered.filter(a => a.category === selectedCategory);
    if (selectedStatus) filtered = filtered.filter(a => a.status === selectedStatus);
    
    setFilteredAssets(filtered);
  }, [assets, searchTerm, selectedFloor, selectedCategory, selectedStatus]);

  const loadAssets = async () => {
    setLoading(true);
    const result = await databaseService.assets.getAll(user.team_id);
    if (result.success) {
      setAssets(result.data);
      setFilteredAssets(result.data);
    }
    setLoading(false);
  };

  const loadFloors = async () => {
    const result = await databaseService.floors.getAll(user.team_id);
    if (result.success) {
      setFloors(result.data);
    }
  };

  const handleSaveAsset = async () => {
    if (!assetForm.name || !assetForm.code || !assetForm.floor_id) {
      alert('Nome, código e andar são obrigatórios');
      return;
    }

    setLoading(true);
    const assetData = { ...assetForm, value: assetForm.value ? parseFloat(assetForm.value) : null };
    
    const result = editingAsset ? 
      await databaseService.assets.update(editingAsset.id, assetData, user.team_id) :
      await databaseService.assets.create(assetData, user.team_id);

    if (result.success) {
      setShowAssetForm(false);
      setEditingAsset(null);
      setAssetForm({
        name: '',
        code: '',
        category: '',
        description: '',
        value: '',
        status: 'Ativo',
        floor_id: '',
        room_id: '',
        photo: '',
        supplier: '',
        serial_number: ''
      });
      await loadAssets();
    } else {
      alert('Erro: ' + result.error);
    }
    setLoading(false);
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
      photo: asset.photo || '',
      supplier: asset.supplier || '',
      serial_number: asset.serial_number || ''
    });
    setShowAssetForm(true);
    setShowAssetDetail(null);
  };

  const handleDeleteAsset = async (asset) => {
    if (confirm(`Tem certeza que deseja excluir o ativo "${asset.name}"?`)) {
      const result = await databaseService.assets.delete(asset.id, user.team_id);
      if (result.success) {
        await loadAssets();
      } else {
        alert('Erro ao excluir: ' + result.error);
      }
    }
  };

  const getFloorName = (floorId) => floors.find(f => f.id === floorId)?.name || 'N/A';
  const getRoomsForFloor = (floorId) => floors.find(f => f.id == floorId)?.rooms || [];

  // Calculate stats
  const stats = {
    totalAssets: assets.length,
    activeAssets: assets.filter(a => a.status === 'Ativo').length,
    totalValue: assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0),
    categories: [...new Set(assets.map(a => a.category).filter(Boolean))].length,
    recentAssets: assets.slice(0, 5)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Icons.Package />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  Sistema de Ativos
                </h1>
                <p className="text-gray-600 font-medium">
                  {user?.team_name && `Time: ${user.team_name}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-blue-50 px-4 py-3 rounded-2xl border border-blue-100">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-600">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <nav className="bg-white/80 backdrop-blur-xl rounded-3xl p-2 mb-8 shadow-xl border border-white/20">
          <div className="flex gap-2">
            {[
              { key: 'dashboard', label: '📊 Dashboard', color: 'from-indigo-600 to-blue-600' },
              { key: 'assets', label: `📦 Ativos (${filteredAssets.length})`, color: 'from-blue-600 to-purple-600' },
              { key: 'locations', label: `🏢 Localizações (${floors.length})`, color: 'from-green-600 to-emerald-600' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${
                  activeTab === tab.key 
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-[1.02]` 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-xl transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-bold uppercase tracking-wide">Total de Ativos</p>
                    <p className="text-4xl font-bold mt-2">{stats.totalAssets}</p>
                    <p className="text-blue-200 text-xs mt-1">+12% este mês</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.Package />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white p-6 rounded-3xl shadow-xl transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-bold uppercase tracking-wide">Ativos Ativos</p>
                    <p className="text-4xl font-bold mt-2">{stats.activeAssets}</p>
                    <p className="text-green-200 text-xs mt-1">{((stats.activeAssets / stats.totalAssets) * 100 || 0).toFixed(0)}% do total</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.TrendingUp />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-6 rounded-3xl shadow-xl transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-bold uppercase tracking-wide">Valor Total</p>
                    <p className="text-2xl font-bold mt-2">R$ {stats.totalValue.toLocaleString('pt-BR')}</p>
                    <p className="text-purple-200 text-xs mt-1">Patrimônio registrado</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.DollarSign />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white p-6 rounded-3xl shadow-xl transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-bold uppercase tracking-wide">Categorias</p>
                    <p className="text-4xl font-bold mt-2">{stats.categories}</p>
                    <p className="text-orange-200 text-xs mt-1">Diferentes tipos</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.BarChart />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Icons.BarChart />
                  Distribuição por Status
                </h3>
                <div className="space-y-4">
                  {statuses.map(status => {
                    const count = assets.filter(a => a.status === status).length;
                    const percentage = stats.totalAssets > 0 ? (count / stats.totalAssets * 100).toFixed(1) : 0;
                    return (
                      <div key={status} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={status} />
                          <span className="font-bold text-gray-900">{count} ativos</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">{percentage}%</span>
                          <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Icons.Clock />
                  Últimos Ativos Cadastrados
                </h3>
                <div className="space-y-4">
                  {stats.recentAssets.map(asset => (
                    <div 
                      key={asset.id} 
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 cursor-pointer transition-all transform hover:scale-[1.02]"
                      onClick={() => setShowAssetDetail(asset)}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl overflow-hidden flex-shrink-0">
                        {asset.photo ? (
                          <img src={asset.photo} alt={asset.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icons.Package />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 truncate">{asset.name}</p>
                        <p className="text-sm text-gray-600">{asset.code} • {getFloorName(asset.floor_id)}</p>
                      </div>
                      <StatusBadge status={asset.status} />
                    </div>
                  ))}
                  {stats.recentAssets.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Icons.Package />
                      <p className="mt-2 font-medium">Nenhum ativo cadastrado ainda</p>
                      <button
                        onClick={() => {
                          setActiveTab('assets');
                          setShowAssetForm(true);
                        }}
                        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                      >
                        Cadastrar primeiro ativo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assets */}
        {activeTab === 'assets' && (
          <div className="space-y-8">
            {/* Controls */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setShowAssetForm(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <Icons.Plus />
                    Novo Ativo
                  </button>
                  <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                    <Icons.Upload />
                    Importar Excel
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900">{filteredAssets.length}</p>
                    <p className="text-sm text-gray-600 font-medium">Ativos encontrados</p>
                  </div>
                  
                  <div className="flex bg-gray-100 rounded-2xl p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md' : 'hover:bg-gray-200'}`}
                    >
                      <Icons.Grid />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md' : 'hover:bg-gray-200'}`}
                    >
                      <Icons.List />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Icons.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar ativos..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                  />
                </div>
                
                <select
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                >
                  <option value="">Todos os andares</option>
                  {floors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                >
                  <option value="">Todos os status</option>
                  {statuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedFloor('');
                    setSelectedCategory('');
                    setSelectedStatus('');
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Icons.Filter />
                  Limpar Filtros
                </button>
              </div>
            </div>

            {/* Assets Grid/List */}
            {loading ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20">
                <LoadingSpinner size="lg" text="Carregando ativos..." />
              </div>
            ) : (
              <>
                {filteredAssets.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-16 shadow-xl border border-white/20 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Icons.Package />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      {searchTerm || selectedFloor || selectedCategory || selectedStatus 
                        ? 'Nenhum ativo encontrado' 
                        : 'Nenhum ativo cadastrado'
                      }
                    </h3>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      {searchTerm || selectedFloor || selectedCategory || selectedStatus
                        ? 'Tente ajustar os filtros para encontrar outros ativos'
                        : 'Comece cadastrando seu primeiro ativo no sistema'
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => setShowAssetForm(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                      >
                        🚀 Cadastrar Primeiro Ativo
                      </button>
                      {(searchTerm || selectedFloor || selectedCategory || selectedStatus) && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedFloor('');
                            setSelectedCategory('');
                            setSelectedStatus('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-2xl font-bold transition-all"
                        >
                          🔄 Limpar Filtros
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                    : "space-y-4"
                  }>
                    {filteredAssets.map(asset => (
                      viewMode === 'grid' ? (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          onView={setShowAssetDetail}
                          onEdit={handleEditAsset}
                          onDelete={handleDeleteAsset}
                          getFloorName={getFloorName}
                        />
                      ) : (
                        <div key={asset.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 border border-gray-100">
                          <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden flex-shrink-0">
                              {asset.photo ? (
                                <img src={asset.photo} alt={asset.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Icons.Package />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">{asset.name}</h3>
                                  <p className="text-sm font-mono text-gray-600">{asset.code}</p>
                                </div>
                                <StatusBadge status={asset.status} />
                              </div>
                              
                              <div className="flex items-center gap-6 text-sm text-gray-600">
                                {asset.category && (
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                    {asset.category}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Icons.MapPin />
                                  {getFloorName(asset.floor_id)}
                                </span>
                                {asset.value && (
                                  <span className="flex items-center gap-1 text-green-700 font-semibold">
                                    <Icons.DollarSign />
                                    R$ {parseFloat(asset.value).toLocaleString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowAssetDetail(asset)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-xl transition-colors"
                              >
                                <Icons.Eye />
                              </button>
                              <button
                                onClick={() => handleEditAsset(asset)}
                                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-colors"
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(asset)}
                                className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl transition-colors"
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Locations */}
        {activeTab === 'locations' && (
          <div className="space-y-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Icons.Building />
                  Localizações Cadastradas
                </h2>
                <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                  <Icons.Plus />
                  Novo Andar
                </button>
              </div>
              
              {floors.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-gradient-to-br from-green-200 to-emerald-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Icons.Building />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Nenhuma localização cadastrada</h3>
                  <p className="text-gray-600 mb-8">Comece cadastrando os andares e salas da sua empresa</p>
                  <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                    🏢 Cadastrar Primeiro Andar
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {floors.map(floor => (
                    <div key={floor.id} className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-3xl border border-green-100 hover:shadow-lg transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-green-900">{floor.name}</h3>
                          {floor.description && (
                            <p className="text-green-700 mt-1">{floor.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl transition-colors">
                            <Icons.Edit />
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-colors">
                            <Icons.Trash />
                          </button>
                        </div>
                      </div>
                      
                      {floor.rooms && floor.rooms.length > 0 ? (
                        <>
                          <div className="mb-4">
                            <p className="text-sm text-green-700 font-medium">
                              {floor.rooms.length} sala{floor.rooms.length !== 1 ? 's' : ''} cadastrada{floor.rooms.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {floor.rooms.map(room => (
                              <div key={room.id} className="bg-white/80 p-4 rounded-2xl border border-green-200 hover:bg-white transition-colors">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-bold text-green-900">{room.name}</h4>
                                    {room.description && (
                                      <p className="text-xs text-green-600 mt-1">{room.description}</p>
                                    )}
                                  </div>
                                  <button className="text-green-600 hover:text-green-700 p-1">
                                    <Icons.Edit />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-green-600 text-sm mb-3">Nenhuma sala cadastrada</p>
                          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                            + Adicionar Sala
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Asset Form Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent">
                    {editingAsset ? '✏️ Editar Ativo' : '➕ Novo Ativo'}
                  </h3>
                  <p className="text-gray-600 mt-2">
                    {editingAsset ? 'Atualize as informações do ativo' : 'Cadastre um novo ativo no sistema'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssetForm(false);
                    setEditingAsset(null);
                    setAssetForm({
                      name: '',
                      code: '',
                      category: '',
                      description: '',
                      value: '',
                      status: 'Ativo',
                      floor_id: '',
                      room_id: '',
                      photo: '',
                      supplier: '',
                      serial_number: ''
                    });
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
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                      placeholder="Ex: Notebook Dell Inspiron 15"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Código *</label>
                    <input
                      type="text"
                      value={assetForm.code}
                      onChange={(e) => setAssetForm({...assetForm, code: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm font-mono transition-all"
                      placeholder="Ex: NB-001"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
                    <select
                      value={assetForm.category}
                      onChange={(e) => setAssetForm({...assetForm, category: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
                    <select
                      value={assetForm.floor_id}
                      onChange={(e) => setAssetForm({...assetForm, floor_id: e.target.value, room_id: ''})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                    >
                      <option value="">Selecione um andar</option>
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
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                      disabled={!assetForm.floor_id}
                    >
                      <option value="">Selecione uma sala</option>
                      {getRoomsForFloor(assetForm.floor_id).map(room => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                    {assetForm.photo ? (
                      <div className="relative">
                        <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                          <img src={assetForm.photo} alt="Foto do ativo" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button
                            type="button"
                            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Icons.Camera />
                            Alterar Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssetForm({...assetForm, photo: ''})}
                            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-64 border-4 border-dashed border-purple-300 rounded-3xl flex items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all bg-gradient-to-br from-purple-50/50 via-blue-50/50 to-cyan-50/50 backdrop-blur-sm">
                        <div className="text-center p-8">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Icons.Camera />
                          </div>
                          <p className="text-gray-700 font-bold text-lg mb-2">📷 Clique para adicionar foto</p>
                          <p className="text-gray-600 mb-4">Tire uma foto ou escolha da galeria</p>
                          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-2xl text-sm font-bold border border-purple-200">
                            <span>📸 Recomendado</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={assetForm.value}
                      onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Status</label>
                    <select
                      value={assetForm.status}
                      onChange={(e) => setAssetForm({...assetForm, status: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Fornecedor</label>
                    <input
                      type="text"
                      value={assetForm.supplier}
                      onChange={(e) => setAssetForm({...assetForm, supplier: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                      placeholder="Nome do fornecedor"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Número de Série</label>
                    <input
                      type="text"
                      value={assetForm.serial_number}
                      onChange={(e) => setAssetForm({...assetForm, serial_number: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm font-mono transition-all"
                      placeholder="SN123456"
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
                  className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 backdrop-blur-sm resize-none transition-all"
                  placeholder="Descrição detalhada do ativo..."
                />
              </div>
              
              <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAssetForm(false);
                    setEditingAsset(null);
                    setAssetForm({
                      name: '',
                      code: '',
                      category: '',
                      description: '',
                      value: '',
                      status: 'Ativo',
                      floor_id: '',
                      room_id: '',
                      photo: '',
                      supplier: '',
                      serial_number: ''
                    });
                  }}
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAsset}
                  disabled={loading}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
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
      )}

      {/* Asset Detail Modal */}
      {showAssetDetail && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                    🔍 Detalhes do Ativo
                  </h3>
                  <p className="text-gray-600 mt-2">Informações completas do ativo</p>
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
                    <p className="text-2xl font-bold text-blue-900">{showAssetDetail.name}</p>
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
                    <div className="flex items-center gap-2 text-indigo-900">
                      <Icons.MapPin />
                      <p className="font-bold text-lg">{getFloorName(showAssetDetail.floor_id)}</p>
                    </div>
                  </div>
                  
                  {showAssetDetail.value && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-2xl border border-yellow-100">
                      <label className="block text-sm font-bold text-yellow-700 mb-2">Valor</label>
                      <div className="flex items-center gap-2">
                        <Icons.DollarSign />
                        <p className="text-2xl font-bold text-yellow-900">
                          R$ {parseFloat(showAssetDetail.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
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
                        <div className="w-full h-full flex items-center justify-center">
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
                      <p className="text-slate-900 leading-relaxed">{showAssetDetail.description}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAssetDetail(null);
                    handleEditAsset(showAssetDetail);
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                >
                  ✏️ Editar Ativo
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
      )}
    </div>
  );
};

// =================== MAIN WRAPPER ===================
const MainApp = () => {
  const { user, loading, connectionError } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) setShowAuthModal(true);
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">🚀 Carregando Sistema</h2>
          <p className="text-gray-600">Conectando com o banco de dados...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center max-w-md border border-red-200">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Erro de Conexão</h2>
          <p className="text-red-600 mb-6 text-sm leading-relaxed">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="text-center max-w-4xl">
            <div className="w-40 h-40 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-12 shadow-2xl transform hover:scale-105 transition-transform">
              <span className="text-6xl">📦</span>
            </div>
            <h1 className="text-6xl lg:text-7xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-8">
              Sistema de Ativos
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-16 font-medium max-w-2xl mx-auto">
              Gerencie todos os seus ativos com tecnologia moderna, análise inteligente e importação simplificada
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button 
                onClick={() => setShowAuthModal(true)} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 rounded-2xl text-xl font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all"
              >
                🚀 Começar Agora
              </button>
              <button className="bg-white/80 backdrop-blur-xl hover:bg-white text-gray-800 border-2 border-gray-200 hover:border-gray-300 px-12 py-6 rounded-2xl text-xl font-bold transition-all shadow-lg hover:shadow-xl">
                📋 Ver Demonstração
              </button>
            </div>
            
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icons.Package />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Gestão Completa</h3>
                <p className="text-gray-600">Cadastre, organize e monitore todos os seus ativos em um só lugar</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icons.Upload />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Importação Excel</h3>
                <p className="text-gray-600">Importe seus dados existentes facilmente através de planilhas</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icons.BarChart />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Relatórios Visuais</h3>
                <p className="text-gray-600">Visualize estatísticas e gere insights sobre seu patrimônio</p>
              </div>
            </div>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return <App />;
};

// =================== ROOT COMPONENT ===================
export default function AppRoot() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
