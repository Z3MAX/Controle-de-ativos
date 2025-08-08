import { getDB } from './lib/db.js';

// Serviços de banco de dados
export const databaseService = {
  // =================== USUÁRIOS ===================
  users: {
    async create(userData) {
      try {
        const db = getDB();
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        const user = {
          ...userData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(user);
          
          request.onsuccess = () => {
            user.id = request.result;
            resolve({ success: true, data: user });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async findByEmail(email) {
      try {
        const db = getDB();
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('email');
        
        return new Promise((resolve, reject) => {
          const request = index.get(email);
          
          request.onsuccess = () => {
            resolve({ success: true, data: request.result });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async update(userId, userData) {
      try {
        const db = getDB();
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        return new Promise((resolve, reject) => {
          const getRequest = store.get(userId);
          
          getRequest.onsuccess = () => {
            const user = getRequest.result;
            if (!user) {
              resolve({ success: false, error: 'Usuário não encontrado' });
              return;
            }
            
            const updatedUser = {
              ...user,
              ...userData,
              updated_at: new Date().toISOString()
            };
            
            const putRequest = store.put(updatedUser);
            
            putRequest.onsuccess = () => {
              resolve({ success: true, data: updatedUser });
            };
            
            putRequest.onerror = () => {
              reject({ success: false, error: putRequest.error });
            };
          };
          
          getRequest.onerror = () => {
            reject({ success: false, error: getRequest.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  // =================== EQUIPES ===================
  teams: {
    async getAll() {
      try {
        const db = getDB();
        const transaction = db.transaction(['teams'], 'readonly');
        const store = transaction.objectStore('teams');
        
        return new Promise((resolve, reject) => {
          const request = store.getAll();
          
          request.onsuccess = () => {
            resolve({ success: true, data: request.result });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async getById(teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['teams'], 'readonly');
        const store = transaction.objectStore('teams');
        
        return new Promise((resolve, reject) => {
          const request = store.get(teamId);
          
          request.onsuccess = () => {
            resolve({ success: true, data: request.result });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async create(teamData) {
      try {
        const db = getDB();
        const transaction = db.transaction(['teams'], 'readwrite');
        const store = transaction.objectStore('teams');
        
        const team = {
          ...teamData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(team);
          
          request.onsuccess = () => {
            team.id = request.result;
            resolve({ success: true, data: team });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  // =================== ANDARES ===================
  floors: {
    async getAll(teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['floors', 'rooms'], 'readonly');
        const floorStore = transaction.objectStore('floors');
        const roomStore = transaction.objectStore('rooms');
        
        return new Promise((resolve, reject) => {
          let floors = [];
          
          if (teamId) {
            // Buscar apenas andares da equipe específica
            const index = floorStore.index('team_id');
            const request = index.getAll(teamId);
            
            request.onsuccess = async () => {
              floors = request.result;
              // Carregar salas para cada andar
              await this.loadRoomsForFloors(floors, roomStore, teamId);
              resolve({ success: true, data: floors });
            };
          } else {
            // Buscar todos os andares
            const request = floorStore.getAll();
            
            request.onsuccess = async () => {
              floors = request.result;
              // Carregar salas para cada andar
              await this.loadRoomsForFloors(floors, roomStore);
              resolve({ success: true, data: floors });
            };
          }
          
          floorStore.onerror = () => {
            reject({ success: false, error: 'Erro ao carregar andares' });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async loadRoomsForFloors(floors, roomStore, teamId = null) {
      for (const floor of floors) {
        const rooms = await new Promise((resolve) => {
          if (teamId) {
            const index = roomStore.index('team_id');
            const request = index.getAll(teamId);
            request.onsuccess = () => {
              // Filtrar salas do andar específico
              const floorRooms = request.result.filter(room => room.floor_id === floor.id);
              resolve(floorRooms);
            };
          } else {
            const index = roomStore.index('floor_id');
            const request = index.getAll(floor.id);
            request.onsuccess = () => resolve(request.result);
          }
        });
        floor.rooms = rooms || [];
      }
    },

    async create(floorData, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['floors'], 'readwrite');
        const store = transaction.objectStore('floors');
        
        const floor = {
          ...floorData,
          team_id: teamId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(floor);
          
          request.onsuccess = () => {
            floor.id = request.result;
            resolve({ success: true, data: floor });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  // =================== SALAS ===================
  rooms: {
    async create(roomData, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['rooms'], 'readwrite');
        const store = transaction.objectStore('rooms');
        
        const room = {
          ...roomData,
          team_id: teamId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(room);
          
          request.onsuccess = () => {
            room.id = request.result;
            resolve({ success: true, data: room });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async update(roomId, roomData, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['rooms'], 'readwrite');
        const store = transaction.objectStore('rooms');
        
        return new Promise((resolve, reject) => {
          const getRequest = store.get(roomId);
          
          getRequest.onsuccess = () => {
            const room = getRequest.result;
            if (!room) {
              resolve({ success: false, error: 'Sala não encontrada' });
              return;
            }
            
            // Verificar se a sala pertence à equipe
            if (room.team_id !== teamId) {
              resolve({ success: false, error: 'Acesso negado' });
              return;
            }
            
            const updatedRoom = {
              ...room,
              ...roomData,
              updated_at: new Date().toISOString()
            };
            
            const putRequest = store.put(updatedRoom);
            
            putRequest.onsuccess = () => {
              resolve({ success: true, data: updatedRoom });
            };
            
            putRequest.onerror = () => {
              reject({ success: false, error: putRequest.error });
            };
          };
          
          getRequest.onerror = () => {
            reject({ success: false, error: getRequest.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async delete(roomId, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['rooms'], 'readwrite');
        const store = transaction.objectStore('rooms');
        
        return new Promise((resolve, reject) => {
          const getRequest = store.get(roomId);
          
          getRequest.onsuccess = () => {
            const room = getRequest.result;
            if (!room) {
              resolve({ success: false, error: 'Sala não encontrada' });
              return;
            }
            
            // Verificar se a sala pertence à equipe
            if (room.team_id !== teamId) {
              resolve({ success: false, error: 'Acesso negado' });
              return;
            }
            
            const deleteRequest = store.delete(roomId);
            
            deleteRequest.onsuccess = () => {
              resolve({ success: true });
            };
            
            deleteRequest.onerror = () => {
              reject({ success: false, error: deleteRequest.error });
            };
          };
          
          getRequest.onerror = () => {
            reject({ success: false, error: getRequest.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  // =================== ATIVOS ===================
  assets: {
    async getAll(teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        
        return new Promise((resolve, reject) => {
          if (teamId) {
            const index = store.index('team_id');
            const request = index.getAll(teamId);
            
            request.onsuccess = () => {
              resolve({ success: true, data: request.result });
            };
          } else {
            const request = store.getAll();
            
            request.onsuccess = () => {
              resolve({ success: true, data: request.result });
            };
          }
          
          store.onerror = () => {
            reject({ success: false, error: 'Erro ao carregar ativos' });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async create(assetData, teamId, userId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        const asset = {
          ...assetData,
          team_id: teamId,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(asset);
          
          request.onsuccess = () => {
            asset.id = request.result;
            resolve({ success: true, data: asset });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async update(assetId, assetData, teamId, userId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        return new Promise((resolve, reject) => {
          const getRequest = store.get(assetId);
          
          getRequest.onsuccess = () => {
            const asset = getRequest.result;
            if (!asset) {
              resolve({ success: false, error: 'Ativo não encontrado' });
              return;
            }
            
            // Verificar se o ativo pertence à equipe
            if (asset.team_id !== teamId) {
              resolve({ success: false, error: 'Acesso negado' });
              return;
            }
            
            const updatedAsset = {
              ...asset,
              ...assetData,
              updated_at: new Date().toISOString()
            };
            
            const putRequest = store.put(updatedAsset);
            
            putRequest.onsuccess = () => {
              resolve({ success: true, data: updatedAsset });
            };
            
            putRequest.onerror = () => {
              reject({ success: false, error: putRequest.error });
            };
          };
          
          getRequest.onerror = () => {
            reject({ success: false, error: getRequest.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async delete(assetId, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        return new Promise((resolve, reject) => {
          const getRequest = store.get(assetId);
          
          getRequest.onsuccess = () => {
            const asset = getRequest.result;
            if (!asset) {
              resolve({ success: false, error: 'Ativo não encontrado' });
              return;
            }
            
            // Verificar se o ativo pertence à equipe
            if (asset.team_id !== teamId) {
              resolve({ success: false, error: 'Acesso negado' });
              return;
            }
            
            const deleteRequest = store.delete(assetId);
            
            deleteRequest.onsuccess = () => {
              resolve({ success: true });
            };
            
            deleteRequest.onerror = () => {
              reject({ success: false, error: deleteRequest.error });
            };
          };
          
          getRequest.onerror = () => {
            reject({ success: false, error: getRequest.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    async checkCodeExists(code, excludeId = null, teamId) {
      try {
        const db = getDB();
        const transaction = db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        const index = store.index('team_id');
        
        return new Promise((resolve, reject) => {
          const request = index.getAll(teamId);
          
          request.onsuccess = () => {
            const assets = request.result;
            const exists = assets.some(asset => 
              asset.code === code && 
              (excludeId === null || asset.id !== excludeId)
            );
            resolve({ success: true, exists });
          };
          
          request.onerror = () => {
            reject({ success: false, error: request.error });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
};
