import { getConnection } from '../lib/db.js';

export const databaseService = {
  // =================== USUÁRIOS ===================
  users: {
    async create(userData) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO users (email, name, company)
          VALUES (${userData.email}, ${userData.name}, ${userData.company || null})
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
          SELECT * FROM users WHERE email = ${email} LIMIT 1
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
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== ANDARES ===================
  floors: {
    async getAll(userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const floors = await sql`
          SELECT * FROM floors 
          WHERE user_id = ${userId}
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

    async create(floorData, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO floors (name, description, user_id)
          VALUES (${floorData.name}, ${floorData.description || null}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE floors 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar andar:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        await sql`
          DELETE FROM floors 
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar andar:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // =================== SALAS ===================
  rooms: {
    async create(roomData, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO rooms (name, description, floor_id, user_id)
          VALUES (${roomData.name}, ${roomData.description || null}, ${roomData.floor_id}, ${userId})
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          UPDATE rooms 
          SET name = ${updates.name}, 
              description = ${updates.description || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        await sql`
          DELETE FROM rooms 
          WHERE id = ${id} AND user_id = ${userId}
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
    async getAll(userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          SELECT * FROM assets 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `;
        return { success: true, data: result };
      } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        return { success: false, error: error.message };
      }
    },

    async create(assetData, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        const result = await sql`
          INSERT INTO assets (
            name, code, category, description, value, status, 
            floor_id, room_id, photo, supplier, serial_number, user_id
          )
          VALUES (
            ${assetData.name}, ${assetData.code}, ${assetData.category || null},
            ${assetData.description || null}, ${assetData.value || null}, ${assetData.status},
            ${assetData.floor_id}, ${assetData.room_id || null}, ${assetData.photo || null},
            ${assetData.supplier || null}, ${assetData.serial_number || null}, ${userId}
          )
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao criar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async update(id, updates, userId) {
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
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *
        `;
        return { success: true, data: result[0] };
      } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async delete(id, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        await sql`
          DELETE FROM assets 
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return { success: true };
      } catch (error) {
        console.error('Erro ao deletar ativo:', error);
        return { success: false, error: error.message };
      }
    },

    async checkCodeExists(code, excludeId = null, userId) {
      try {
        const sql = await getConnection();
        if (!sql) throw new Error('Conexão não disponível');

        let query;
        if (excludeId) {
          query = await sql`
            SELECT COUNT(*) as count FROM assets 
            WHERE code = ${code} AND id != ${excludeId} AND user_id = ${userId}
          `;
        } else {
          query = await sql`
            SELECT COUNT(*) as count FROM assets 
            WHERE code = ${code} AND user_id = ${userId}
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
