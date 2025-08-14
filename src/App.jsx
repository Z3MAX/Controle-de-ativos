import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import * as XLSX from 'xlsx';

const AuthContext = createContext({});
const useAuth = () => useContext(AuthContext);

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

const databaseService = {
  async getConnection() {
    if (!import.meta.env.VITE_DATABASE_URL) throw new Error('VITE_DATABASE_URL não configurada');
    const { neon } = await import('@neondatabase/serverless');
    return neon(import.meta.env.VITE_DATABASE_URL);
  },

  async testConnection() {
    try {
      console.log('🔄 Testando conexão com Neon...');
      const sql = await this.getConnection();
      
      // Teste de conexão com timeout
      const testQuery = new Promise(async (resolve, reject) => {
        try {
          const result = await sql`SELECT NOW() as current_time`;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na conexão (10s)')), 10000);
      });

      const result = await Promise.race([testQuery, timeoutPromise]);
      console.log('✅ Conexão Neon estabelecida:', result[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Falha na conexão Neon:', error.message);
      return false;
    }
  },

  async initializeDatabase() {
    try {
      console.log('🔄 Inicializando estrutura do banco...');
      const sql = await this.getConnection();
      
      // Criar tabelas com melhor tratamento de erros
      console.log('📋 Criando tabela teams...');
      await sql`CREATE TABLE IF NOT EXISTS teams (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      
      console.log('👤 Criando tabela users...');
      await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, password_hash VARCHAR(255), company VARCHAR(255), photo TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      
      console.log('🏢 Criando tabela floors...');
      await sql`CREATE TABLE IF NOT EXISTS floors (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      
      console.log('🚪 Criando tabela rooms...');
      await sql`CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      
      console.log('📦 Criando tabela assets...');
      await sql`CREATE TABLE IF NOT EXISTS assets (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(100) UNIQUE NOT NULL, category VARCHAR(100), description TEXT, value DECIMAL(12,2), status VARCHAR(50) DEFAULT 'Ativo', floor_id INTEGER REFERENCES floors(id), room_id INTEGER REFERENCES rooms(id), photo TEXT, supplier VARCHAR(255), serial_number VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

      // MIGRAÇÃO: Adicionar colunas team_id se não existirem
      console.log('🔧 Verificando migrações necessárias...');
      
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id)`;
        console.log('✅ Coluna team_id adicionada à tabela users');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe em users ou erro:', error.message);
      }

      try {
        await sql`ALTER TABLE floors ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada à tabela floors');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe em floors ou erro:', error.message);
      }

      try {
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada à tabela rooms');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe em rooms ou erro:', error.message);
      }

      try {
        await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
        console.log('✅ Coluna team_id adicionada à tabela assets');
      } catch (error) {
        console.log('ℹ️ Coluna team_id já existe em assets ou erro:', error.message);
      }

      // Remover constraint UNIQUE antigo se existir e criar novo
      try {
        await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_code_key`;
        await sql`ALTER TABLE assets ADD CONSTRAINT assets_code_team_unique UNIQUE(code, team_id)`;
        console.log('✅ Constraint de código único por time aplicada');
      } catch (error) {
        console.log('ℹ️ Constraint já existe ou erro:', error.message);
      }

      // Verificar e criar times padrão
      console.log('🏢 Verificando times padrão...');
      const existingTeams = await sql`SELECT COUNT(*) as count FROM teams`;
      if (parseInt(existingTeams[0].count) === 0) {
        console.log('➕ Criando times padrão...');
        const defaultTeams = [
          { name: 'TI', description: 'Tecnologia da Informação' },
          { name: 'Facilities', description: 'Facilities e Infraestrutura' },
          { name: 'Administrativo', description: 'Administrativo e Financeiro' }
        ];
        for (const team of defaultTeams) {
          await sql`INSERT INTO teams (name, description) VALUES (${team.name}, ${team.description})`;
          console.log(`✅ Time "${team.name}" criado`);
        }
      }

      // Atualizar registros existentes sem team_id para o primeiro time
      try {
        const firstTeam = await sql`SELECT id FROM teams ORDER BY id LIMIT 1`;
        if (firstTeam.length > 0) {
          const teamId = firstTeam[0].id;
          
          await sql`UPDATE users SET team_id = ${teamId} WHERE team_id IS NULL`;
          await sql`UPDATE floors SET team_id = ${teamId} WHERE team_id IS NULL`;
          await sql`UPDATE rooms SET team_id = ${teamId} WHERE team_id IS NULL`;
          await sql`UPDATE assets SET team_id = ${teamId} WHERE team_id IS NULL`;
          
          console.log(`✅ Registros existentes atribuídos ao time padrão (ID: ${teamId})`);
        }
      } catch (error) {
        console.log('ℹ️ Erro ao atualizar registros existentes:', error.message);
      }

      // Criar índices para performance
      console.log('📊 Criando índices...');
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_assets_team_id ON assets(team_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_assets_code_team ON assets(code, team_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_floors_team_id ON floors(team_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_rooms_team_id ON rooms(team_id)`;

      console.log('✅ Banco inicializado com sucesso!');
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
        console.error('Erro teams.getAll:', error);
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
        console.error('Erro users.create:', error);
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
        console.error('Erro users.authenticate:', error);
        return { success: false, error: 'Erro na autenticação' };
      }
    },

    async findByEmail(email) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`SELECT u.*, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.email = ${email} LIMIT 1`;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro users.findByEmail:', error);
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
        console.error('Erro floors.getAll:', error);
        return { success: false, error: error.message };
      }
    },

    async create(floorData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`INSERT INTO floors (name, description, team_id) VALUES (${floorData.name}, ${floorData.description || null}, ${teamId}) RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro floors.create:', error);
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
        console.error('Erro rooms.create:', error);
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
        console.error('Erro assets.getAll:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`INSERT INTO assets (name, code, category, description, value, status, floor_id, room_id, photo, supplier, serial_number, team_id) VALUES (${assetData.name}, ${assetData.code}, ${assetData.category || null}, ${assetData.description || null}, ${assetData.value || null}, ${assetData.status}, ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null}, ${assetData.supplier || null}, ${assetData.serial_number || null}, ${teamId}) RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro assets.create:', error);
        return { success: false, error: error.message };
      }
    },

    async createBatch(assetsData, teamId) {
      const results = [];
      const errors = [];
      for (let i = 0; i < assetsData.length; i++) {
        try {
          const result = await this.create(assetsData[i], teamId);
          if (result.success) results.push(result.data);
          else errors.push({ row: i + 1, asset: assetsData[i], error: result.error });
        } catch (error) {
          errors.push({ row: i + 1, asset: assetsData[i], error: error.message });
        }
      }
      return { success: true, data: { created: results, errors, totalProcessed: assetsData.length, successCount: results.length, errorCount: errors.length } };
    },

    async update(id, updates, teamId) {
      try {
        const sql = await databaseService.getConnection();
        const result = await sql`UPDATE assets SET name = ${updates.name}, code = ${updates.code}, category = ${updates.category || null}, description = ${updates.description || null}, value = ${updates.value || null}, status = ${updates.status}, floor_id = ${updates.floor_id}, room_id = ${updates.room_id || null}, photo = ${updates.photo || null}, supplier = ${updates.supplier || null}, serial_number = ${updates.serial_number || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} AND team_id = ${teamId} RETURNING *`;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro assets.update:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await databaseService.getConnection();
        await sql`DELETE FROM assets WHERE id = ${id} AND team_id = ${teamId}`;
        return { success: true };
      } catch (error) {
        console.error('Erro assets.delete:', error);
        return { success: false, error: error.message };
      }
    }
  }
};

const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Package: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  AlertCircle: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  CheckCircle: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  BarChart3: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Trash2: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  MapPin: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  DollarSign: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  FileSpreadsheet: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 13H8m0 4h8m0-8H8" /></svg>,
  Camera: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  FileText: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  RotateCcw: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 4v6h6m16 10v-6h-6M7.15 9.14a8 8 0 1110.85 2.86" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.9 5.4L12 7.2l-5.1 1.2L5 14l-1.9-5.4L12 7.2l5.1 1.2L19 3l1.9 5.4L26 7.2l-5.1 1.2L19 14" /></svg>,
  Zap: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
};

const ExcelImportModal = ({ isOpen, onClose, onImport, floors, categories, statuses }) => {
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

  const processExcelFile = async (file) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) throw new Error('Arquivo deve ter pelo menos cabeçalho e uma linha');

      const headers = jsonData[0].filter(h => h && h.toString().trim());
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      setExcelData({ headers, rows });
      
      const autoMapping = {};
      headers.forEach((header, index) => {
        const h = header.toString().toLowerCase();
        if (h.includes('nome') || h.includes('name')) autoMapping[index] = 'name';
        else if (h.includes('código') || h.includes('code')) autoMapping[index] = 'code';
        else if (h.includes('categoria')) autoMapping[index] = 'category';
        else if (h.includes('valor')) autoMapping[index] = 'value';
        else if (h.includes('status')) autoMapping[index] = 'status';
        else if (h.includes('andar')) autoMapping[index] = 'floor_name';
        else if (h.includes('sala')) autoMapping[index] = 'room_name';
        else if (h.includes('fornecedor')) autoMapping[index] = 'supplier';
        else if (h.includes('série')) autoMapping[index] = 'serial_number';
      });

      setColumnMapping(autoMapping);
      setShowMapping(true);
      
      const preview = rows.slice(0, 5).map(row => {
        const mappedRow = {};
        Object.entries(autoMapping).forEach(([colIndex, fieldKey]) => {
          mappedRow[fieldKey] = row[parseInt(colIndex)] || '';
        });
        return mappedRow;
      });
      setPreviewData(preview);
      
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setIsProcessing(false);
        <div className="bg-white/80 rounded-3xl p-2 mb-8 shadow-xl">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-6 py-4 rounded-2xl font-bold ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white' : 'text-gray-600 hover:bg-indigo-50'}`}>
              📊 Dashboard
            </button>
            <button onClick={() => setActiveTab('assets')} className={`flex-1 px-6 py-4 rounded-2xl font-bold ${activeTab === 'assets' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-gray-600 hover:bg-blue-50'}`}>
              📦 Ativos ({filteredAssets.length})
            </button>
            <button onClick={() => setActiveTab('locations')} className={`flex-1 px-6 py-4 rounded-2xl font-bold ${activeTab === 'locations' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white' : 'text-gray-600 hover:bg-green-50'}`}>
              🏢 Localizações ({floors.length})
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-bold">Total de Ativos</p>
                    <p className="text-3xl font-bold">{stats.totalAssets}</p>
                  </div>
                  <Icons.Package />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-bold">Ativos Ativos</p>
                    <p className="text-3xl font-bold">{stats.activeAssets}</p>
                  </div>
                  <Icons.CheckCircle />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-bold">Valor Total</p>
                    <p className="text-2xl font-bold">R$ {stats.totalValue.toLocaleString('pt-BR')}</p>
                  </div>
                  <Icons.DollarSign />
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-bold">Categorias</p>
                    <p className="text-3xl font-bold">{stats.categories}</p>
                  </div>
                  <Icons.BarChart3 />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/80 rounded-3xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Distribuição por Status</h3>
                <div className="space-y-4">
                  {statuses.map(status => {
                    const count = assets.filter(a => a.status === status).length;
                    const percentage = stats.totalAssets > 0 ? (count / stats.totalAssets * 100).toFixed(1) : 0;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <StatusBadge status={status} />
                          <span className="font-bold">{count} ativos</span>
                        </div>
                        <span className="text-sm text-gray-600">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/80 rounded-3xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📦 Últimos Ativos</h3>
                <div className="space-y-4">
                  {stats.recentAssets.map(asset => (
                    <div key={asset.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 cursor-pointer" onClick={() => setShowAssetDetail(asset)}>
                      <div className="w-12 h-12 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                        {asset.photo ? (
                          <img src={asset.photo} alt={asset.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icons.Package />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{asset.name}</p>
                        <p className="text-sm text-gray-600">{asset.code} • {getFloorName(asset.floor_id)}</p>
                      </div>
                      <StatusBadge status={asset.status} />
                    </div>
                  ))}
                  {stats.recentAssets.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Icons.Package />
                      <p className="mt-2">Nenhum ativo cadastrado ainda</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/80 rounded-3xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🏢 Distribuição por Andar</h3>
                <div className="space-y-4">
                  {floors.map(floor => {
                    const floorAssets = assets.filter(a => a.floor_id === floor.id);
                    const percentage = stats.totalAssets > 0 ? (floorAssets.length / stats.totalAssets * 100).toFixed(1) : 0;
                    return (
                      <div key={floor.id} className="flex items-center justify-between p-4 bg-green-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-green-900">{floor.name}</p>
                          <p className="text-sm text-green-700">{floorAssets.length} ativos</p>
                        </div>
                        <span className="text-sm text-green-600 font-bold">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/80 rounded-3xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🏷️ Distribuição por Categoria</h3>
                <div className="space-y-4">
                  {categories.map(category => {
                    const categoryAssets = assets.filter(a => a.category === category);
                    const percentage = stats.totalAssets > 0 ? (categoryAssets.length / stats.totalAssets * 100).toFixed(1) : 0;
                    return (
                      <div key={category} className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-purple-900">{category}</p>
                          <p className="text-sm text-purple-700">{categoryAssets.length} ativos</p>
                        </div>
                        <span className="text-sm text-purple-600 font-bold">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

  // Função de análise simulada por IA
  const simulateAIAnalysis = (imageData) => {
    const objects = [
      { name: 'Notebook', confidence: 92, category: 'Informática', description: 'Notebook para desenvolvimento' },
      { name: 'Monitor', confidence: 88, category: 'Informática', description: 'Monitor LED 24 polegadas' },
      { name: 'Cadeira', confidence: 85, category: 'Móveis', description: 'Cadeira ergonômica de escritório' },
      { name: 'Mesa', confidence: 90, category: 'Móveis', description: 'Mesa de escritório em madeira' },
      { name: 'Impressora', confidence: 87, category: 'Equipamentos', description: 'Impressora multifuncional' }
    ];
    
    return objects[Math.floor(Math.random() * objects.length)];
  };

  // Funções de foto
  const openPhotoOptions = () => {
    setPhotoState(prev => ({ ...prev, showOptions: true }));
  };

  const closeAllPhotoModals = () => {
    setPhotoState({
      showOptions: false,
      showCamera: false, 
      showPreview: false,
      capturedPhoto: null,
      isProcessing: false,
      error: '',
      aiAnalysis: null
    });
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      setPhotoState(prev => ({ ...prev, showOptions: false, showCamera: true, error: '' }));
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 1280, height: 720 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setPhotoState(prev => ({ ...prev, error: 'Erro ao acessar câmera: ' + error.message, showCamera: false }));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoState(prev => ({ 
      ...prev, 
      capturedPhoto: photoDataUrl, 
      showCamera: false, 
      showPreview: true 
    }));
    
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const selectFromGallery = () => {
    setPhotoState(prev => ({ ...prev, showOptions: false }));
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoState(prev => ({ 
          ...prev, 
          capturedPhoto: e.target.result, 
          showPreview: true 
        }));
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const processPhotoWithAI = async (photoData) => {
    setPhotoState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const analysis = simulateAIAnalysis(photoData);
      
      setPhotoState(prev => ({ ...prev, aiAnalysis: analysis, isProcessing: false }));
      
      setAssetForm(prevForm => ({
        ...prevForm,
        name: analysis.name,
        category: analysis.category,
        description: analysis.description,
        photo: photoData
      }));
      
    } catch (error) {
      setPhotoState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: 'Erro na análise: ' + error.message 
      }));
    }
  };

  const confirmPhoto = async () => {
    if (photoState.capturedPhoto) {
      await processPhotoWithAI(photoState.capturedPhoto);
      closeAllPhotoModals();
    }
  };

  const retakePhoto = () => {
    setPhotoState(prev => ({ 
      ...prev, 
      showPreview: false, 
      capturedPhoto: null 
    }));
    startCamera();
  };

  const removePhotoFromForm = () => {
    setAssetForm(prev => ({ ...prev, photo: '' }));
    setPhotoState(prev => ({ ...prev, aiAnalysis: null }));
  };

  const resetAssetForm = () => {
    setAssetForm({ name: '', code: '', category: '', description: '', value: '', status: 'Ativo', floor_id: '', room_id: '', photo: '', supplier: '', serial_number: '' });
    setPhotoState(prev => ({ ...prev, aiAnalysis: null }));
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

  const handleImport = async () => {
    setIsProcessing(true);
    try {
      const assetsToImport = excelData.rows.map(row => {
        const asset = { name: '', code: '', category: '', description: '', value: null, status: 'Ativo', floor_id: null, room_id: null, supplier: '', serial_number: '' };

        Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
          const cellValue = row[parseInt(colIndex)];
          if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
            if (fieldKey === 'floor_name') {
              const floor = floors.find(f => f.name.toLowerCase().includes(cellValue.toString().toLowerCase()) || cellValue.toString().toLowerCase().includes(f.name.toLowerCase()));
              if (floor) asset.floor_id = floor.id;
            } else if (fieldKey === 'room_name') {
              asset._room_name = cellValue.toString().trim();
            } else if (fieldKey === 'value') {
              const numValue = parseFloat(cellValue);
              asset.value = isNaN(numValue) ? null : numValue;
            } else {
              asset[fieldKey] = cellValue.toString().trim();
            }
          }
        });

        if (asset._room_name && asset.floor_id) {
          const floor = floors.find(f => f.id === asset.floor_id);
          if (floor?.rooms) {
            const room = floor.rooms.find(r => r.name.toLowerCase().includes(asset._room_name.toLowerCase()) || asset._room_name.toLowerCase().includes(r.name.toLowerCase()));
            if (room) asset.room_id = room.id;
          }
        }
        delete asset._room_name;
        return asset;
      });

      await onImport(assetsToImport);
      onClose();
    } catch (error) {
      alert('Erro na importação: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Nome do Ativo', 'Código', 'Categoria', 'Descrição', 'Valor', 'Status', 'Andar', 'Sala', 'Fornecedor', 'Número de Série'],
      ['Notebook Dell', 'NB-001', 'Informática', 'Notebook desenvolvimento', '2500.00', 'Ativo', '11º Andar', 'Sala Desenvolvimento', 'Dell', 'DL240001']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ativos');
    XLSX.writeFile(wb, 'template_ativos.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-3xl font-bold text-gray-900">📊 Importar Excel</h3>
            <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl"><Icons.X /></button>
          </div>

          {!showMapping ? (
            <div className="space-y-8">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                <h4 className="text-lg font-bold text-blue-900 mb-4">📁 Selecionar Arquivo</h4>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-4 border-dashed border-blue-300 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-blue-100"
                >
                  <div className="text-center">
                    <Icons.Upload />
                    <p className="text-blue-700 font-bold mt-2">
                      {file ? file.name : 'Clique para selecionar Excel'}
                    </p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files[0]; if (f) { setFile(f); processExcelFile(f); } }} className="hidden" />
                <button onClick={downloadTemplate} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-2xl font-bold">📥 Baixar Template</button>
              </div>
              {isProcessing && <div className="text-center py-8"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div><p className="text-blue-600 font-bold">Processando...</p></div>}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-purple-50 p-6 rounded-2xl">
                <h4 className="text-lg font-bold text-purple-900 mb-4">🔗 Mapeamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  {assetFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-bold text-purple-700 mb-2">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={Object.keys(columnMapping).find(key => columnMapping[key] === field.key) || ''}
                        onChange={(e) => {
                          const newMapping = { ...columnMapping };
                          Object.keys(newMapping).forEach(key => { if (newMapping[key] === field.key) delete newMapping[key]; });
                          if (e.target.value !== '') newMapping[e.target.value] = field.key;
                          setColumnMapping(newMapping);
                        }}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Não mapear</option>
                        {excelData.headers.map((header, index) => (
                          <option key={index} value={index}>Col {index + 1}: {header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {previewData.length > 0 && (
                <div className="bg-green-50 p-6 rounded-2xl">
                  <h4 className="text-lg font-bold text-green-900 mb-4">👀 Preview</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-green-100">{['Nome', 'Código', 'Categoria', 'Andar'].map(h => <th key={h} className="p-2 text-left font-bold">{h}</th>)}</tr></thead>
                      <tbody>{previewData.map((row, i) => <tr key={i} className="bg-white"><td className="p-2">{row.name || '-'}</td><td className="p-2">{row.code || '-'}</td><td className="p-2">{row.category || '-'}</td><td className="p-2">{row.floor_name || '-'}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setShowMapping(false)} className="px-6 py-3 border-2 border-gray-300 rounded-2xl">⬅️ Voltar</button>
                <button onClick={handleImport} disabled={isProcessing} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold">
                  {isProcessing ? 'Importando...' : '📥 Importar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ImportResultModal = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-4xl p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-3xl font-bold text-gray-900">📈 Resultado</h3>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl"><Icons.X /></button>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 p-6 rounded-2xl text-center">
            <p className="text-sm font-bold text-blue-700">Total</p>
            <p className="text-3xl font-bold text-blue-900">{result.totalProcessed}</p>
          </div>
          <div className="bg-green-50 p-6 rounded-2xl text-center">
            <p className="text-sm font-bold text-green-700">Sucesso</p>
            <p className="text-3xl font-bold text-green-900">{result.successCount}</p>
          </div>
          <div className="bg-red-50 p-6 rounded-2xl text-center">
            <p className="text-sm font-bold text-red-700">Erros</p>
            <p className="text-3xl font-bold text-red-900">{result.errorCount}</p>
          </div>
        </div>
        {result.errors?.length > 0 && (
          <div className="bg-red-50 p-6 rounded-2xl mb-8">
            <h4 className="text-lg font-bold text-red-900 mb-4">❌ Erros</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {result.errors.map((error, i) => (
                <div key={i} className="bg-white p-3 rounded-lg border">
                  <p className="text-red-800 text-sm">Linha {error.row}: {error.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-center">
          <button onClick={onClose} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold">✅ Concluir</button>
        </div>
      </div>
    </div>
  );
};

// AuthProvider CORRIGIDO
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const createDefaultFloors = async (teamId) => {
    if (!teamId) return;
    
    try {
      const existingFloors = await databaseService.floors.getAll(teamId);
      if (!existingFloors.success || existingFloors.data.length > 0) return;

      console.log('🏢 Criando andares padrão para o time...');
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
          console.log(`✅ Andar "${floorData.name}" criado com salas`);
        }
      }
    } catch (error) {
      console.error('Erro ao criar andares padrão:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔄 Inicializando sistema de ativos...');
        
        // Verificar se a variável de ambiente existe
        if (!import.meta.env.VITE_DATABASE_URL) {
          setConnectionError('❌ VITE_DATABASE_URL não configurada. Configure no Netlify em Environment Variables.');
          setLoading(false);
          return;
        }

        console.log('🔗 Testando conexão com Neon Database...');
        const connected = await databaseService.testConnection();
        
        if (!connected) {
          setConnectionError('❌ Falha na conexão com Neon Database. Verifique se a connection string está correta e se o projeto está ativo.');
          setLoading(false);
          return;
        }

        console.log('📋 Inicializando estrutura do banco de dados...');
        await databaseService.initializeDatabase();
        setDbReady(true);
        console.log('✅ Banco de dados pronto!');

        // Verificar usuário salvo localmente
        const savedUser = localStorage.getItem('asset_manager_user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            console.log('🔍 Verificando usuário salvo:', userData.email);
            
            const userCheck = await databaseService.users.findByEmail(userData.email);
            
            if (userCheck.success && userCheck.data) {
              setUser(userCheck.data);
              await createDefaultFloors(userCheck.data.team_id);
              console.log('✅ Usuário restaurado:', userCheck.data.name);
            } else {
              localStorage.removeItem('asset_manager_user');
              console.log('🔄 Usuário salvo não encontrado no banco, removido do localStorage');
            }
          } catch (error) {
            localStorage.removeItem('asset_manager_user');
            console.log('🔄 Dados de usuário corrompidos, removidos do localStorage');
          }
        }

        console.log('✅ Sistema inicializado com sucesso!');
      } catch (error) {
        console.error('❌ Erro crítico na inicialização:', error);
        setConnectionError(`Erro na inicialização: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const signUp = async (email, password, name, company = '', photo = null, team_id = null) => {
    try {
      console.log('📝 Criando novo usuário:', { email, name, company, team_id });
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
        console.log('✅ Usuário criado e logado com sucesso:', result.data.name);
        return result;
      } else {
        console.error('❌ Erro ao criar usuário:', result.error);
        return result;
      }
    } catch (error) {
      console.error('❌ Erro crítico no signUp:', error);
      return { success: false, error: error.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('🔐 Tentando fazer login:', email);
      const result = await databaseService.users.authenticate(email, password);
      
      if (result.success) {
        setUser(result.data);
        localStorage.setItem('asset_manager_user', JSON.stringify(result.data));
        await createDefaultFloors(result.data.team_id);
        console.log('✅ Login realizado com sucesso:', result.data.name);
      } else {
        console.error('❌ Erro no login:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erro crítico no signIn:', error);
      return { success: false, error: error.message };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('asset_manager_user');
    console.log('👋 Logout realizado');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      dbReady, 
      connectionError, 
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [teams, setTeams] = useState([]);
  const { signIn, signUp } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '', name: '', company: '', team_id: '' });

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
      setMessage('✅ ' + (isLogin ? 'Login realizado!' : 'Conta criada!'));
      setTimeout(onClose, 1500);
    } else {
      setMessage('❌ ' + result.error);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"><Icons.X /></button>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><Icons.User /></div>
          <h2 className="text-2xl font-bold text-gray-900">{isLogin ? 'Entrar' : 'Criar Conta'}</h2>
        </div>

        {message && <div className={`p-4 rounded-lg mb-6 text-sm ${message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nome *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="Seu nome" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Empresa</label>
                <input type="text" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="Nome da empresa" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Time</label>
                <select value={formData.team_id} onChange={(e) => setFormData({...formData, team_id: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione um time</option>
                  {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">E-mail *</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="seu@email.com" required />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Senha *</label>
            <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="Sua senha" required />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-bold">
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>

          <div className="text-center pt-4">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:text-blue-700 font-bold">
              {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState([]);
  const [floors, setFloors] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetForm, setAssetForm] = useState({ name: '', code: '', category: '', description: '', value: '', status: 'Ativo', floor_id: '', room_id: '', photo: '', supplier: '', serial_number: '' });
  const [showAssetDetail, setShowAssetDetail] = useState(null);
  const [photoState, setPhotoState] = useState({
    showOptions: false,
    showCamera: false,
    showPreview: false,
    capturedPhoto: null,
    isProcessing: false,
    error: '',
    aiAnalysis: null
  });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const categories = ['Informática', 'Móveis', 'Equipamentos', 'Veículos', 'Eletrônicos', 'Outros'];
  const statuses = ['Ativo', 'Inativo', 'Manutenção', 'Descartado'];

  useEffect(() => {
    if (user?.team_id) {
      console.log('👤 Carregando dados para o usuário:', user.name);
      loadAssets();
      loadFloors();
    }
  }, [user]);

  const loadAssets = async () => {
    try {
      console.log('📦 Carregando ativos...');
      const result = await databaseService.assets.getAll(user.team_id);
      if (result.success) {
        setAssets(result.data);
        setFilteredAssets(result.data);
        console.log(`✅ ${result.data.length} ativos carregados`);
      } else {
        console.error('❌ Erro ao carregar ativos:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao carregar ativos:', error);
    }
  };

  const loadFloors = async () => {
    try {
      console.log('🏢 Carregando andares...');
      const result = await databaseService.floors.getAll(user.team_id);
      if (result.success) {
        setFloors(result.data);
        console.log(`✅ ${result.data.length} andares carregados`);
      } else {
        console.error('❌ Erro ao carregar andares:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao carregar andares:', error);
    }
  };

  useEffect(() => {
    let filtered = assets;
    if (searchTerm) filtered = filtered.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.code.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedFloor) filtered = filtered.filter(a => a.floor_id == selectedFloor);
    if (selectedCategory) filtered = filtered.filter(a => a.category === selectedCategory);
    setFilteredAssets(filtered);
  }, [assets, searchTerm, selectedFloor, selectedCategory]);

  const handleExcelImport = async (assetsData) => {
    try {
      console.log(`📊 Importando ${assetsData.length} ativos do Excel...`);
      const result = await databaseService.assets.createBatch(assetsData, user.team_id);
      if (result.success) {
        setImportResult(result.data);
        setShowImportResult(true);
        await loadAssets();
        console.log(`✅ Importação concluída: ${result.data.successCount} sucessos, ${result.data.errorCount} erros`);
      }
    } catch (error) {
      console.error('❌ Erro na importação Excel:', error);
      alert('Erro na importação: ' + error.message);
    }
  };

  const handleSaveAsset = async () => {
    if (!assetForm.name || !assetForm.code || !assetForm.floor_id) {
      alert('❌ Nome, código e andar são obrigatórios');
      return;
    }

    try {
      console.log('💾 Salvando ativo:', assetForm.name);
      const assetData = { ...assetForm, value: assetForm.value ? parseFloat(assetForm.value) : null };
      const result = editingAsset ? 
        await databaseService.assets.update(editingAsset.id, assetData, user.team_id) :
        await databaseService.assets.create(assetData, user.team_id);

      if (result.success) {
        setShowAssetForm(false);
        setEditingAsset(null);
        setAssetForm({ name: '', code: '', category: '', description: '', value: '', status: 'Ativo', floor_id: '', room_id: '', photo: '', supplier: '', serial_number: '' });
        await loadAssets();
        console.log(`✅ Ativo ${editingAsset ? 'atualizado' : 'criado'} com sucesso`);
      } else {
        console.error('❌ Erro ao salvar ativo:', result.error);
        alert('❌ Erro: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao salvar ativo:', error);
      alert('❌ Erro crítico: ' + error.message);
    }
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      'Ativo': 'bg-green-100 text-green-800',
      'Inativo': 'bg-gray-100 text-gray-800',
      'Manutenção': 'bg-yellow-100 text-yellow-800',
      'Descartado': 'bg-red-100 text-red-800'
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[status]}`}>{status}</span>;
  };

  const getFloorName = (floorId) => floors.find(f => f.id === floorId)?.name || 'N/A';
  const getRoomsForFloor = (floorId) => floors.find(f => f.id == floorId)?.rooms || [];
  const getRoomName = (roomId) => {
    for (const floor of floors) {
      const room = floor.rooms?.find(r => r.id === roomId);
      if (room) return room.name;
    }
    return 'N/A';
  };

  // Estatísticas para o dashboard
  const stats = {
    totalAssets: assets.length,
    activeAssets: assets.filter(a => a.status === 'Ativo').length,
    totalValue: assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0),
    categories: [...new Set(assets.map(a => a.category).filter(Boolean))].length,
    floors: floors.length,
    recentAssets: assets.slice(0, 5)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">📦 Sistema de Ativos</h1>
              <p className="text-gray-600 mt-2">{user?.team_name && `Time: ${user.team_name}`}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-blue-100 px-4 py-3 rounded-2xl">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center"><Icons.User /></div>
                <div><p className="font-bold">{user?.name}</p><p className="text-sm text-gray-600">{user?.email}</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 rounded-3xl p-2 mb-8 shadow-xl">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('assets')} className={`flex-1 px-6 py-4 rounded-2xl font-bold ${activeTab === 'assets' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-gray-600 hover:bg-blue-50'}`}>
              📦 Ativos ({filteredAssets.length})
            </button>
            <button onClick={() => setActiveTab('locations')} className={`flex-1 px-6 py-4 rounded-2xl font-bold ${activeTab === 'locations' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white' : 'text-gray-600 hover:bg-green-50'}`}>
              🏢 Localizações ({floors.length})
            </button>
          </div>
        </div>

        {activeTab === 'assets' && (
          <div className="space-y-8">
            <div className="bg-white/80 rounded-3xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-3">
                  <button onClick={() => setShowAssetForm(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-4 rounded-2xl flex items-center space-x-3 font-bold">
                    <Icons.Plus /><span>➕ Novo Ativo</span>
                  </button>
                  <button onClick={() => setShowExcelImport(true)} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl flex items-center space-x-3 font-bold">
                    <Icons.FileSpreadsheet /><span>📊 Importar Excel</span>
                  </button>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{filteredAssets.length}</p>
                  <p className="text-sm text-gray-600">Ativos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500" />
                <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos andares</option>
                  {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas categorias</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => { setSearchTerm(''); setSelectedFloor(''); setSelectedCategory(''); }} className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold">🔄 Limpar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="bg-white/90 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{asset.name}</h3>
                      <p className="text-sm font-mono text-gray-600 bg-gray-100 px-3 py-1 rounded-lg inline-block">{asset.code}</p>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                  
                  {asset.photo && (
                    <div className="w-full h-40 bg-gray-100 rounded-2xl overflow-hidden mb-4">
                      <img src={asset.photo} alt={asset.name} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    {asset.category && <p className="text-sm"><span className="font-bold">🏷️</span> {asset.category}</p>}
                    <p className="text-sm flex items-center"><Icons.MapPin className="w-4 h-4 mr-1" /> {getFloorName(asset.floor_id)}</p>
                    {asset.value && <p className="text-sm flex items-center text-green-700"><Icons.DollarSign className="w-4 h-4 mr-1" /> R$ {parseFloat(asset.value).toLocaleString('pt-BR')}</p>}
                  </div>

                  <div className="flex space-x-3">
                    <button onClick={() => { setShowAssetDetail(asset); }} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-2xl flex items-center justify-center space-x-2 font-bold">
                      <Icons.Eye /><span>Ver</span>
                    </button>
                    <button onClick={() => { setEditingAsset(asset); setAssetForm({ name: asset.name, code: asset.code, category: asset.category || '', description: asset.description || '', value: asset.value || '', status: asset.status, floor_id: asset.floor_id, room_id: asset.room_id || '', photo: asset.photo || '', supplier: asset.supplier || '', serial_number: asset.serial_number || '' }); setShowAssetForm(true); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl flex items-center justify-center space-x-2 font-bold">
                      <Icons.Edit /><span>Editar</span>
                    </button>
                    <button onClick={async () => { if (confirm('Excluir ativo?')) { const result = await databaseService.assets.delete(asset.id, user.team_id); if (result.success) { await loadAssets(); console.log('✅ Ativo excluído'); } else { alert('Erro ao excluir: ' + result.error); } } }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-2xl">
                      <Icons.Trash2 />
                    </button>
                  </div>
                </div>
              ))}

              {filteredAssets.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">📦 Nenhum ativo encontrado</h3>
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => setShowAssetForm(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-bold">➕ Novo Ativo</button>
                    <button onClick={() => setShowExcelImport(true)} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold">📊 Importar Excel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="bg-white/80 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold mb-6">🏢 Localizações</h2>
            <div className="space-y-6">
              {floors.map(floor => (
                <div key={floor.id} className="bg-green-50 p-6 rounded-2xl">
                  <h3 className="text-xl font-bold text-green-900">{floor.name}</h3>
                  <p className="text-green-700">{floor.description}</p>
                  {floor.rooms?.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {floor.rooms.map(room => (
                        <div key={room.id} className="bg-white p-4 rounded-xl">
                          <h4 className="font-bold">{room.name}</h4>
                          {room.description && <p className="text-sm text-gray-600">{room.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAssetForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-bold">{editingAsset ? '✏️ Editar Ativo' : '➕ Novo Ativo'}</h3>
                <button onClick={() => { setShowAssetForm(false); setEditingAsset(null); }} className="p-3 hover:bg-gray-100 rounded-2xl"><Icons.X /></button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Nome *</label>
                    <input type="text" value={assetForm.name} onChange={(e) => setAssetForm({...assetForm, name: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500" placeholder="Nome do ativo" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Código *</label>
                    <input type="text" value={assetForm.code} onChange={(e) => setAssetForm({...assetForm, code: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500 font-mono" placeholder="Código único" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
                    <select value={assetForm.category} onChange={(e) => setAssetForm({...assetForm, category: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500">
                      <option value="">Selecione categoria</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Andar *</label>
                    <select value={assetForm.floor_id} onChange={(e) => setAssetForm({...assetForm, floor_id: e.target.value, room_id: ''})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500">
                      <option value="">Selecione andar</option>
                      {floors.map(floor => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Sala</label>
                    <select value={assetForm.room_id} onChange={(e) => setAssetForm({...assetForm, room_id: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500" disabled={!assetForm.floor_id}>
                      <option value="">Selecione sala</option>
                      {getRoomsForFloor(assetForm.floor_id).map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto do Ativo</label>
                    <div className="space-y-4">
                      {assetForm.photo ? (
                        <div className="relative">
                          <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                            <img src={assetForm.photo} alt="Foto do ativo" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex space-x-3 mt-4">
                            <button type="button" onClick={openPhotoOptions} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-4 rounded-2xl flex items-center justify-center space-x-3 text-sm font-bold">
                              <Icons.Camera /><span>📷 Alterar Foto</span>
                            </button>
                            <button type="button" onClick={removePhotoFromForm} className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-4 rounded-2xl">
                              <Icons.Trash2 />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div onClick={openPhotoOptions} className="w-full h-64 border-4 border-dashed border-purple-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 bg-gradient-to-br from-purple-50/50 via-blue-50/50 to-cyan-50/50">
                          <div className="text-center p-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                              <Icons.Camera />
                            </div>
                            <p className="text-gray-700 font-bold text-lg mb-2">📷 Clique para adicionar foto</p>
                            <p className="text-gray-600 font-medium mb-4">Tire uma foto ou escolha da galeria</p>
                            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-2xl text-sm font-bold">
                              <Icons.Sparkles />
                              <span className="ml-2">Com análise de IA</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Valor (R$)</label>
                    <input type="number" step="0.01" value={assetForm.value} onChange={(e) => setAssetForm({...assetForm, value: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Status</label>
                    <select value={assetForm.status} onChange={(e) => setAssetForm({...assetForm, status: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500">
                      {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Fornecedor</label>
                    <input type="text" value={assetForm.supplier} onChange={(e) => setAssetForm({...assetForm, supplier: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500" placeholder="Nome do fornecedor" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Número de Série</label>
                    <input type="text" value={assetForm.serial_number} onChange={(e) => setAssetForm({...assetForm, serial_number: e.target.value})} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500 font-mono" placeholder="SN123456" />
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <label className="block text-sm font-bold text-gray-700 mb-3">Descrição</label>
                <textarea value={assetForm.description} onChange={(e) => setAssetForm({...assetForm, description: e.target.value})} rows={4} className="w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-purple-500 resize-none" placeholder="Descrição detalhada..." />
              </div>
              
              <div className="flex justify-end space-x-4 mt-10 pt-6 border-t">
                <button onClick={() => { setShowAssetForm(false); setEditingAsset(null); resetAssetForm(); }} className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 font-bold">Cancelar</button>
                <button onClick={handleSaveAsset} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl font-bold">
                  {editingAsset ? '✅ Atualizar' : '💾 Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Opções de Foto */}
      {photoState.showOptions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">📷 Adicionar Foto</h3>
              <button onClick={closeAllPhotoModals} className="p-2 hover:bg-gray-100 rounded-xl"><Icons.X /></button>
            </div>
            <div className="space-y-4">
              <button onClick={startCamera} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-5 rounded-2xl flex items-center justify-center space-x-3 font-bold">
                <Icons.Camera /><span>📷 Tirar Foto</span>
              </button>
              <button onClick={selectFromGallery} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-5 rounded-2xl flex items-center justify-center space-x-3 font-bold">
                <Icons.Upload /><span>📁 Escolher da Galeria</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal da Câmera */}
      {photoState.showCamera && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="w-full h-full relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
              <button onClick={closeAllPhotoModals} className="bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-2xl font-bold">❌ Cancelar</button>
              <button onClick={capturePhoto} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold">📸 Capturar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Preview da Foto */}
      {photoState.showPreview && photoState.capturedPhoto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">🖼️ Preview da Foto</h3>
                <button onClick={closeAllPhotoModals} className="p-2 hover:bg-gray-100 rounded-xl"><Icons.X /></button>
              </div>
              <div className="w-full bg-gray-100 rounded-2xl overflow-hidden mb-6">
                <img src={photoState.capturedPhoto} alt="Foto capturada" className="w-full h-auto" />
              </div>
              <div className="flex space-x-4">
                <button onClick={confirmPhoto} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-2xl font-bold">✅ Usar Foto</button>
                <button onClick={retakePhoto} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-4 rounded-2xl font-bold">🔄 Refazer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading de Processamento IA */}
      {photoState.isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-10 text-center shadow-2xl">
            <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-2xl font-bold mb-3">🤖 Analisando com IA</h3>
            <p className="text-gray-600">Identificando objeto na foto...</p>
          </div>
        </div>
      )}

      {/* Notificação de Análise IA */}
      {photoState.aiAnalysis && (
        <div className="fixed top-6 right-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl shadow-2xl z-50 max-w-sm">
          <div className="flex items-start space-x-3">
            <Icons.Zap />
            <div>
              <p className="font-bold">🤖 IA Detectou:</p>
              <p className="text-sm opacity-90">{photoState.aiAnalysis.name} ({photoState.aiAnalysis.confidence}% confiança)</p>
              <p className="text-xs opacity-75 mt-1">Dados preenchidos automaticamente!</p>
            </div>
            <button onClick={() => setPhotoState(prev => ({ ...prev, aiAnalysis: null }))} className="hover:bg-white/20 rounded-xl p-1"><Icons.X /></button>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Ativo */}
      {showAssetDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-bold">🔍 Detalhes do Ativo</h3>
                <button onClick={() => setShowAssetDetail(null)} className="p-3 hover:bg-gray-100 rounded-2xl"><Icons.X /></button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-2xl">
                    <label className="block text-sm font-bold text-blue-700 mb-2">Nome</label>
                    <p className="text-xl font-bold text-blue-900">{showAssetDetail.name}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-2xl">
                    <label className="block text-sm font-bold text-purple-700 mb-2">Código</label>
                    <p className="text-lg font-mono font-bold text-purple-900">{showAssetDetail.code}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-2xl">
                    <label className="block text-sm font-bold text-green-700 mb-2">Categoria</label>
                    <p className="text-lg font-bold text-green-900">{showAssetDetail.category || 'Sem categoria'}</p>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-2xl">
                    <label className="block text-sm font-bold text-orange-700 mb-2">Status</label>
                    <StatusBadge status={showAssetDetail.status} />
                  </div>
                  <div className="bg-indigo-50 p-6 rounded-2xl">
                    <label className="block text-sm font-bold text-indigo-700 mb-2">Localização</label>
                    <p className="font-bold text-indigo-900">{getFloorName(showAssetDetail.floor_id)} {showAssetDetail.room_id ? `- ${getRoomName(showAssetDetail.room_id)}` : ''}</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-4">📷 Foto</label>
                    <div className="w-full h-80 bg-gray-100 rounded-2xl overflow-hidden">
                      {showAssetDetail.photo ? (
                        <img src={showAssetDetail.photo} alt={showAssetDetail.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Icons.Camera /><span className="ml-2">Sem foto</span></div>
                      )}
                    </div>
                  </div>
                  {showAssetDetail.description && (
                    <div className="bg-slate-50 p-6 rounded-2xl">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                      <p className="text-slate-900">{showAssetDetail.description}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
                <button onClick={() => handleEditAsset(showAssetDetail)} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold">✏️ Editar</button>
                <button onClick={() => setShowAssetDetail(null)} className="px-8 py-4 border-2 border-gray-300 rounded-2xl font-bold">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      <ExcelImportModal isOpen={showExcelImport} onClose={() => setShowExcelImport(false)} onImport={handleExcelImport} floors={floors} categories={categories} statuses={statuses} />
      <ImportResultModal isOpen={showImportResult} onClose={() => { setShowImportResult(false); setImportResult(null); }} result={importResult} />
    </div>
  );
};

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
          <h2 className="text-2xl font-bold text-gray-800">🚀 Carregando Sistema...</h2>
          <p className="text-gray-600 mt-2">Conectando com o banco de dados...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icons.AlertCircle />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">❌ Erro de Conexão</h2>
          <p className="text-red-600 mb-6 text-sm leading-relaxed">{connectionError}</p>
          <div className="space-y-3">
            <button onClick={() => window.location.reload()} className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold">🔄 Tentar Novamente</button>
            <p className="text-xs text-gray-500">
              Se o problema persistir, verifique a configuração da VITE_DATABASE_URL no Netlify
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
          <div className="text-center max-w-2xl">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
              <Icons.Package />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-6">📦 Sistema de Ativos</h1>
            <p className="text-xl text-gray-600 mb-12 font-medium">Gerencie seus ativos com IA e importação Excel</p>
            <button onClick={() => setShowAuthModal(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-5 rounded-2xl text-xl font-bold shadow-2xl">🚀 Começar</button>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return <App />;
};

export default function AppRoot() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
