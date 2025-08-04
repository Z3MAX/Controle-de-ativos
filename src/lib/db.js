// Configuração simplificada para evitar problemas de build
let sql = null;

// Função para inicializar a conexão apenas quando necessário
const initConnection = async () => {
  if (sql) return sql;
  
  try {
    if (typeof window !== 'undefined' && import.meta.env.VITE_DATABASE_URL) {
      const { neon } = await import('@neondatabase/serverless');
      sql = neon(import.meta.env.VITE_DATABASE_URL);
      return sql;
    }
    return null;
  } catch (error) {
    console.error('Erro ao inicializar conexão:', error);
    return null;
  }
};

// Função para testar conexão
export async function testConnection() {
  try {
    const connection = await initConnection();
    if (!connection) {
      console.log('❌ Variável VITE_DATABASE_URL não configurada');
      return false;
    }

    const result = await connection`SELECT NOW() as current_time`;
    console.log('✅ Conexão com NeonDB estabelecida:', result[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com NeonDB:', error);
    return false;
  }
}

// Função para obter conexão
export async function getConnection() {
  return await initConnection();
}

// Função para inicializar o banco (criar tabelas se não existirem)
export async function initializeDatabase() {
  try {
    const connection = await initConnection();
    if (!connection) return false;

    // Criar tabela de usuários
    await connection`
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
    await connection`
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
    await connection`
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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, user_id)
      )
    `;

    // Criar índices para melhor performance
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_floor_id ON assets(floor_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_room_id ON assets(room_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_floors_user_id ON floors(user_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_user_id ON rooms(user_id)`;

    console.log('✅ Banco de dados inicializado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    return false;
  }
}
