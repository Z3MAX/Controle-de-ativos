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

// Exportar a conexão para uso direto (compatibilidade)
export { sql };

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

    // Criar tabela de times
    await connection`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela de usuários
    await connection`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Adicionar coluna team_id se não existir (migração)
    try {
      await connection`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`;
      console.log('✅ Coluna team_id adicionada/verificada na tabela users');
    } catch (error) {
      console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
    }

    // Criar tabela de andares
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

    // Adicionar coluna team_id e remover user_id dos floors (migração)
    try {
      await connection`ALTER TABLE floors ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
      console.log('✅ Coluna team_id adicionada/verificada na tabela floors');
    } catch (error) {
      console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
    }

    // Criar tabela de salas
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

    // Adicionar coluna team_id e remover user_id das rooms (migração)
    try {
      await connection`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
      console.log('✅ Coluna team_id adicionada/verificada na tabela rooms');
    } catch (error) {
      console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
    }

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
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, team_id)
      )
    `;

    // Adicionar coluna team_id e remover user_id dos assets (migração)
    try {
      await connection`ALTER TABLE assets ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;
      console.log('✅ Coluna team_id adicionada/verificada na tabela assets');
    } catch (error) {
      console.log('ℹ️ Coluna team_id já existe ou erro na migração:', error);
    }

    // Criar times padrão se não existirem
    const existingTeams = await connection`SELECT COUNT(*) as count FROM teams`;
    if (parseInt(existingTeams[0].count) === 0) {
      console.log('🏢 Criando times padrão...');
      
      const defaultTeams = [
        { name: 'TI', description: 'Equipe de Tecnologia da Informação' },
        { name: 'Facilities', description: 'Equipe de Facilities e Infraestrutura' },
        { name: 'Administrativo', description: 'Equipe Administrativa e Financeira' },
        { name: 'Recursos Humanos', description: 'Equipe de Recursos Humanos' }
      ];

      for (const team of defaultTeams) {
        await connection`
          INSERT INTO teams (name, description)
          VALUES (${team.name}, ${team.description})
        `;
        console.log(`✅ Time "${team.name}" criado`);
      }
    }

    // Criar índices para melhor performance
    await connection`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_team_id ON assets(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_floor_id ON assets(floor_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_assets_room_id ON assets(room_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_floors_team_id ON floors(team_id)`;
    await connection`CREATE INDEX IF NOT EXISTS idx_rooms_team_id ON rooms(team_id)`;

    console.log('✅ Banco de dados inicializado com sistema de times');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    return false;
  }
}
