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

// =================== MODERN ICONS ===================
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
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Filter: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
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
  Trash: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
  BarChart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  DollarSign: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12,6 12,12 16,14"></polyline>
    </svg>
  ),
  Grid: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  List: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  ),
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="9"></rect>
      <rect x="14" y="3" width="7" height="5"></rect>
      <rect x="14" y="12" width="7" height="9"></rect>
      <rect x="3" y="16" width="7" height="5"></rect>
    </svg>
  ),
  Layers: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="12,2 2,7 12,12 22,7"></polygon>
      <polyline points="2,17 12,22 22,17"></polyline>
      <polyline points="2,12 12,17 22,12"></polyline>
    </svg>
  ),
  Activity: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
    </svg>
  ),
  Archive: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="21,8 21,21 3,21 3,8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>
  ),
  Zap: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"></polygon>
    </svg>
  ),
  Award: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="7"></circle>
      <polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88"></polyline>
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
    </svg>
  )
};

// =================== LOADING COMPONENT ===================
const LoadingSpinner = ({ size = 'md', text = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className={`${sizeClasses[size]} border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4`}></div>
      {text && <p className="text-slate-600 font-medium">{text}</p>}
    </div>
  );
};

// =================== STATUS BADGE ===================
const StatusBadge = ({ status }) => {
  const variants = {
    'Ativo': 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg',
    'Inativo': 'bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-lg',
    'Manutenção': 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg',
    'Descartado': 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
  };

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${variants[status] || variants.Inativo}`}>
      <span className="w-2 h-2 bg-white rounded-full"></span>
      {status}
    </span>
  );
};

// =================== ASSET CARD ===================
const AssetCard = ({ asset, onView, onEdit, onDelete, getFloorName }) => {
  return (
    <div className="group bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border border-slate-200/50 hover:border-indigo-300 transform hover:-translate-y-2">
      <div className="relative h-56 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        {asset.photo ? (
          <>
            <img 
              src={asset.photo} 
              alt={asset.name} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
                <Icons.Package />
              </div>
              <p className="text-slate-400 text-sm font-medium">Sem imagem</p>
            </div>
          </div>
        )}
        
        <div className="absolute top-4 right-4">
          <StatusBadge status={asset.status} />
        </div>

        <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
          <div className="flex gap-2">
            <button
              onClick={() => onView(asset)}
              className="flex-1 bg-white/95 backdrop-blur-sm text-slate-800 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-white flex items-center justify-center gap-2 shadow-lg"
            >
              <Icons.Eye />
              Ver
            </button>
            <button
              onClick={() => onEdit(asset)}
              className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg"
            >
              <Icons.Edit />
              Editar
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate mb-2">
            {asset.name}
          </h3>
          <p className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-lg inline-block">
            {asset.code}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {asset.category && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Icons.Layers />
              </div>
              <span className="text-slate-600 font-medium">{asset.category}</span>
            </div>
          )}
          
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Icons.MapPin />
            </div>
            <span className="text-slate-600 font-medium">{getFloorName(asset.floor_id)}</span>
          </div>

          {asset.value && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Icons.DollarSign />
              </div>
              <span className="text-green-700 font-bold">R$ {parseFloat(asset.value).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <button
            onClick={() => onDelete(asset)}
            className="bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-xl transition-colors group-hover:bg-red-500 group-hover:text-white"
          >
            <Icons.Trash />
          </button>
        </div>
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
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Icons.User />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {isLogin ? 'Bem-vindo de volta!' : 'Criar Conta'}
          </h2>
          <p className="text-slate-600">
            {isLogin ? 'Acesse sua conta para continuar' : 'Crie sua conta gratuita para começar'}
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-medium border ${
            message.includes('✅') 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all"
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Empresa (opcional)</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-4 py-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all"
                  placeholder="Nome da sua empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Time</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({...formData, team_id: e.target.value})}
                  className="w-full px-4 py-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all"
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
            <label className="block text-sm font-bold text-slate-700 mb-3">E-mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Senha</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 transition-all"
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 text-white px-6 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processando...</span>
              </div>
            ) : (
              isLogin ? 'Entrar na Conta' : 'Criar Conta'
            )}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-indigo-600 hover:text-indigo-700 font-bold text-sm transition-colors"
            >
              {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =================== PHOTO HANDLER ===================
const usePhotoHandler = (onPhotoCapture) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      setIsCapturing(true);
      setShowPhotoOptions(false);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error('Erro ao acessar a câmera:', error);
      alert('Não foi possível acessar a câmera. Tente fazer upload de uma imagem.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      onPhotoCapture(dataURL);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onPhotoCapture(e.target.result);
        setShowPhotoOptions(false);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const openPhotoOptions = () => {
    setShowPhotoOptions(true);
  };

  const closePhotoOptions = () => {
    setShowPhotoOptions(false);
    stopCamera();
  };

  return {
    videoRef,
    canvasRef,
    fileInputRef,
    isCapturing,
    showPhotoOptions,
    startCamera,
    capturePhoto,
    stopCamera,
    handleFileUpload,
    openPhotoOptions,
    closePhotoOptions
  };
};

// =================== PHOTO MODAL ===================
const PhotoModal = ({ 
  isOpen, 
  onClose, 
  videoRef, 
  canvasRef, 
  fileInputRef, 
  isCapturing, 
  onStartCamera, 
  onCapturePhoto, 
  onFileUpload 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-white/20">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-3xl font-black text-slate-900">Adicionar Foto</h3>
            <button
              onClick={onClose}
              className="p-3 hover:bg-slate-100 rounded-2xl transition-all"
            >
              <Icons.X />
            </button>
          </div>

          {isCapturing ? (
            <div className="space-y-6">
              <div className="relative bg-black rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-80 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={onCapturePhoto}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                >
                  <Icons.Camera />
                  Capturar Foto
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-100 transition-all font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={onStartCamera}
                  className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white p-8 rounded-2xl font-bold text-lg flex flex-col items-center gap-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.Camera />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black mb-2">Tirar Foto</p>
                    <p className="text-sm opacity-90">Use a câmera do dispositivo</p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white p-8 rounded-2xl font-bold text-lg flex flex-col items-center gap-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Icons.Upload />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black mb-2">Escolher Arquivo</p>
                    <p className="text-sm opacity-90">Selecionar da galeria</p>
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>
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

  const photoHandler = usePhotoHandler((photo) => {
    setAssetForm(prev => ({...prev, photo}));
  });

  const removePhoto = () => {
    setAssetForm(prev => ({...prev, photo: ''}));
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-40 shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-all">
                <Icons.Package />
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
                  Asset Manager Pro
                </h1>
                <p className="text-slate-600 font-medium text-lg">
                  {user?.team_name && `Time: ${user.team_name}`} • Sistema Inteligente de Ativos
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 rounded-2xl border border-indigo-200">
                <div className="w-12 h-12 bg-gradient
