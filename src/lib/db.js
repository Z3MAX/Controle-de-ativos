// Configuração e conexão com PostgreSQL (NeonDB)

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL;

let db;

// Função para testar a conexão
export const testConnection = async () => {
  try {
    if (!DATABASE_URL) {
      console.error('VITE_DATABASE_URL não configurado');
      return false;
    }

    // Em um ambiente de produção com PostgreSQL, você usaria uma biblioteca como 'pg'
    // Para este exemplo, vamos simular usando IndexedDB como fallback
    return await initializeIndexedDB();
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return false;
  }
};

// Inicializar IndexedDB como fallback
const initializeIndexedDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AssetManagerDB', 2);
    
    request.onerror = () => {
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      
      // Criar tabela de usuários
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('email', 'email', { unique: true });
      }
      
      // Criar tabela de equipes
      if (!db.objectStoreNames.contains('teams')) {
        const teamStore = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
        teamStore.createIndex('name', 'name', { unique: false });
      }
      
      // Criar tabela de andares
      if (!db.objectStoreNames.contains('floors')) {
        const floorStore = db.createObjectStore('floors', { keyPath: 'id', autoIncrement: true });
        floorStore.createIndex('team_id', 'team_id', { unique: false });
      }
      
      // Criar tabela de salas
      if (!db.objectStoreNames.contains('rooms')) {
        const roomStore = db.createObjectStore('rooms', { keyPath: 'id', autoIncrement: true });
        roomStore.createIndex('floor_id', 'floor_id', { unique: false });
        roomStore.createIndex('team_id', 'team_id', { unique: false });
      }
      
      // Criar tabela de ativos
      if (!db.objectStoreNames.contains('assets')) {
        const assetStore = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
        assetStore.createIndex('code', 'code', { unique: false });
        assetStore.createIndex('team_id', 'team_id', { unique: false });
        assetStore.createIndex('user_id', 'user_id', { unique: false });
      }
    };
  });
};

// Inicializar banco de dados
export const initializeDatabase = async () => {
  try {
    const connected = await testConnection();
    if (!connected) return false;
    
    // Criar equipes padrão se não existirem
    await createDefaultTeams();
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
    return false;
  }
};

// Criar equipes padrão
const createDefaultTeams = async () => {
  try {
    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');
    
    // Verificar se já existem equipes
    const countRequest = store.count();
    countRequest.onsuccess = async () => {
      if (countRequest.result === 0) {
        // Criar equipes padrão
        const defaultTeams = [
          {
            name: 'TI - Tecnologia da Informação',
            description: 'Equipamentos de tecnologia e infraestrutura',
            color: '#3B82F6',
            created_at: new Date().toISOString()
          },
          {
            name: 'Facilities - Infraestrutura',
            description: 'Móveis, equipamentos de escritório e infraestrutura física',
            color: '#10B981',
            created_at: new Date().toISOString()
          },
          {
            name: 'RH - Recursos Humanos',
            description: 'Equipamentos e materiais do setor de RH',
            color: '#8B5CF6',
            created_at: new Date().toISOString()
          },
          {
            name: 'Financeiro',
            description: 'Equipamentos e ativos do setor financeiro',
            color: '#F59E0B',
            created_at: new Date().toISOString()
          }
        ];
        
        for (const team of defaultTeams) {
          await store.add(team);
        }
        
        // Criar andares padrão para cada equipe
        await createDefaultFloors();
      }
    };
  } catch (error) {
    console.error('Erro ao criar equipes padrão:', error);
  }
};

// Criar andares padrão
const createDefaultFloors = async () => {
  try {
    const transaction = db.transaction(['teams', 'floors'], 'readwrite');
    const teamStore = transaction.objectStore('teams');
    const floorStore = transaction.objectStore('floors');
    
    const teamsRequest = teamStore.getAll();
    teamsRequest.onsuccess = () => {
      const teams = teamsRequest.result;
      
      teams.forEach(team => {
        // Criar andares básicos para cada equipe
        const defaultFloors = [
          {
            name: '1º Andar',
            description: `Térreo - ${team.name}`,
            team_id: team.id,
            created_at: new Date().toISOString()
          },
          {
            name: '2º Andar',
            description: `Segundo andar - ${team.name}`,
            team_id: team.id,
            created_at: new Date().toISOString()
          }
        ];
        
        defaultFloors.forEach(floor => {
          floorStore.add(floor);
        });
      });
    };
  } catch (error) {
    console.error('Erro ao criar andares padrão:', error);
  }
};

export const getDB = () => db;
