import { getConnection } from '../lib/db.js';

export const databaseService = {
  // =================== TIMES ===================
  teams: {
    async getAll() {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT * FROM teams ORDER BY name
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar times:', error);
        return { success: false, error: error.message };
      }
    },

    async create(teamData) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO teams (name, description)
          VALUES (${teamData.name}, ${teamData.description || null})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar time:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE teams 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar time:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        // Verificar se existem usuários no time
        const usersCheck = await sql`
          SELECT COUNT(*) as count FROM users WHERE team_id = ${id}
        `;
        
        if (parseInt(usersCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir o time pois existem usuários vinculados a ele' 
          };
        }

        await sql`DELETE FROM teams WHERE id = ${id}`;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar time:', error);
        return { success: false, error: error.message };
      }
    },

    async getMembers(teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT id, email, name, company, created_at, updated_at 
          FROM users 
          WHERE team_id = ${teamId} 
          ORDER BY name
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar membros do time:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== USUÁRIOS ===================
  users: {
    async create(userData) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO users (email, name, company, team_id)
          VALUES (${userData.email}, ${userData.name}, ${userData.company || null}, ${userData.team_id || null})
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
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT u.*, t.name as team_name, t.description as team_description
          FROM users u
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE u.email = ${email} 
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE users 
          SET name = ${updates.name}, 
              company = ${updates.company || null},
              team_id = ${updates.team_id || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return { success: false, error: error.message };
      }
    },

    async getUserTeam(userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT u.team_id, t.name as team_name, t.description as team_description
          FROM users u
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE u.id = ${userId}
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar time do usuário:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== ANDARES ===================
  floors: {
    async getAll(teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const floors = await sql`
          SELECT * FROM floors 
          WHERE team_id = ${teamId}
          ORDER BY name
        `;
        
        // Buscar salas para cada andar
        for (let floor of floors) {
          const rooms = await sql`
            SELECT * FROM rooms 
            WHERE floor_id = ${floor.id}
            ORDER BY name
          `;
          floor.rooms = rooms;
        }
        
        return { success: true, data: floors };
      } catch (error) {
        console.error('Erro ao buscar andares:', error);
        return { success: false, error: error.message };
      }
    },

    async create(floorData, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO floors (name, description, team_id)
          VALUES (${floorData.name}, ${floorData.description || null}, ${teamId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE floors 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE floor_id = ${id} AND team_id = ${teamId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir o andar pois existem ativos vinculados a ele' 
          };
        }

        await sql`
          DELETE FROM floors 
          WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async getByName(name, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');
        const result = await sql`
          SELECT * FROM floors 
          WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) AND team_id = ${teamId}
          LIMIT 1
        `;
        return { success: true, data: result[0] || null };
      } catch (error) {
        console.error('Erro ao buscar andar por nome:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== SALAS ===================
  rooms: {
    async create(roomData, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO rooms (name, description, floor_id, team_id)
          VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${teamId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE rooms 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              floor_id = ${updates.floor_id},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const assetsCheck = await sql`
          SELECT COUNT(*) as count FROM assets WHERE room_id = ${id} AND team_id = ${teamId}
        `;
        
        if (parseInt(assetsCheck[0].count) > 0) {
          return { 
            success: false, 
            error: 'Não é possível excluir a sala pois existem ativos vinculados a ela' 
          };
        }

        await sql`
          DELETE FROM rooms 
          WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar sala:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== ATIVOS ===================
  assets: {
    async getAll(teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT * FROM assets 
          WHERE team_id = ${teamId}
          ORDER BY created_at DESC
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO assets (
            name, code, category, description, value, status, 
            floor_id, room_id, photo, supplier, serial_number, team_id
          )
          VALUES (
            ${assetData.name}, ${assetData.code}, ${assetData.category || null},
            ${assetData.description || null}, ${assetData.value || null}, ${assetData.status},
            ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
            ${assetData.supplier || null}, ${assetData.serial_number || null}, ${teamId}
          )
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE assets 
          SET name = ${updates.name}, 
              code = ${updates.code},
              category = ${updates.category || null},
              description = ${updates.description || null},
              value = ${updates.value || null},
              status = ${updates.status},
              floor_id = ${updates.floor_id},
              room_id = ${updates.room_id || null},
              photo = ${updates.photo || null},
              supplier = ${updates.supplier || null},
              serial_number = ${updates.serial_number || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND team_id = ${teamId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        await sql`
          DELETE FROM assets 
          WHERE id = ${id} AND team_id = ${teamId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async checkCodeExists(code, excludeId = null, teamId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        let query;
        if (excludeId) {
          query = await sql`
            SELECT COUNT(*) as count FROM assets 
            WHERE code = ${code} AND id != ${excludeId} AND team_id = ${teamId}
          `;
        } else {
          query = await sql`
            SELECT COUNT(*) as count FROM assets 
            WHERE code = ${code} AND team_id = ${teamId}
          `;
        }
        
        const exists = parseInt(query[0].count) > 0;
        return { success: true, exists };
      } catch (error) {
        console.error('Erro ao verificar código:', error);
        return { success: false, error: error.message };
      }
    }
  }
};
