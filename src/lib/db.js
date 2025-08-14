// src/lib/db.js - Versão Corrigida
let sql = null;

const initConnection = async () => {
  if (sql) return sql;
  
  try {
    const dbUrl = import.meta.env.VITE_DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error('VITE_DATABASE_URL não configurada');
    }

    console.log('🔄 Iniciando conexão Neon...');
    
    if (typeof window !== 'undefined') {
      const { neon } = await import('@neondatabase/serverless');
      sql = neon(dbUrl);
      
      // Teste de conexão com timeout
      const testQuery = new Promise(async (resolve, reject) => {
        try {
          const result = await sql`SELECT 1 as test`;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na conexão')), 10000);
      });

      await Promise.race([testQuery, timeoutPromise]);
      console.log('✅ Conexão Neon estabelecida com sucesso');
      return sql;
    }
    
    throw new Error('Ambiente não suportado');
  } catch (error) {
    console.error('❌ Erro ao conectar com Neon:', error);
    sql = null;
    throw error;
  }
};

export async function testConnection() {
  try {
    const connection = await initConnection();
    if (!connection) return false;

    const result = await connection`SELECT NOW() as current_time`;
    console.log('✅ Teste de conexão bem-sucedido:', result[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Falha no teste de conexão:', error.message);
    return false;
  }
}

export async function getConnection() {
  return await initConnection();
}

export async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');
    const connection = await initConnection();
    if (!connection) throw new Error('Conexão não disponível');

    // Criar tabelas com IF NOT EXISTS para evitar erros
    console.log('📋 Criando tabela teams...');
    await connection`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('👤 Criando tabela users...');
    await connection`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        company VARCHAR(255),
        photo TEXT,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('🏢 Criando tabela floors...');
    await connection`
      CREATE TABLE IF NOT EXISTS floors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('🚪 Criando tabela rooms...');
    await connection`
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

    console.log('📦 Criando tabela assets...');
    await connection`
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

    // Verificar e criar times padrão
    console.log('🏢 Verificando times padrão...');
    const existingTeams = await connection`SELECT COUNT(*) as count FROM teams`;
    
    if (parseInt(existingTeams[0].count) === 0) {
      console.log('➕ Criando times padrão...');
      const defaultTeams = [
        { name: 'TI', description: 'Tecnologia da Informação' },
        { name: 'Facilities', description: 'Facilities e Infraestrutura' },
        { name: 'Administrativo', description: 'Administrativo e Financeiro' }
      ];

      for (const team of defaultTeams) {
        await connection`
          INSERT INTO teams (name, description)
          VALUES (${team.name}, ${team.description})
        `;
        console.log(`✅ Time "${team.name}" criado`);
      }
    }

    // Criar índices para performance
    console.log('📊 Criando índices...');
    await connection`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_team_id ON assets(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_code_team ON assets(code, team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_floors_team_id ON floors(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_team_id ON rooms(team_id)`;

    console.log('✅ Banco de dados inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro na inicialização do banco:', error);
    throw error;
  }
}
