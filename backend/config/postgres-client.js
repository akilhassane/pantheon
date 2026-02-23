/**
 * PostgreSQL Client Wrapper
 * 
 * Provides a Supabase-compatible interface for direct PostgreSQL connections
 * Used when USE_LOCAL_POSTGRES=true
 */

const { Pool } = require('pg');

let pool = null;

/**
 * Get or create PostgreSQL connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPostgresPool() {
  if (pool) {
    return pool;
  }

  // Use LOCAL_DATABASE_URL if available, otherwise fall back to DATABASE_URL
  const databaseUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('LOCAL_DATABASE_URL or DATABASE_URL environment variable is required for local PostgreSQL');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected error on idle client', err);
  });

  console.log('[PostgreSQL] Connection pool initialized');
  
  return pool;
}

/**
 * Create a Supabase-compatible query builder for PostgreSQL
 * @param {string} tableName - Table name
 * @returns {Object} Query builder
 */
function from(tableName) {
  const pool = getPostgresPool();
  
  return {
    _tableName: tableName,
    _selectColumns: '*',
    _filters: [],
    _orderBy: null,
    _limit: null,
    _single: false,
    _count: false,
    _head: false,

    select(columns = '*', options = {}) {
      this._selectColumns = columns;
      if (options.count) {
        this._count = options.count;
      }
      if (options.head) {
        this._head = true;
      }
      return this;
    },

    insert(data) {
      this._operation = 'insert';
      this._data = Array.isArray(data) ? data : [data];
      return this;
    },

    update(data) {
      this._operation = 'update';
      this._data = data;
      return this;
    },

    delete() {
      this._operation = 'delete';
      return this;
    },

    eq(column, value) {
      this._filters.push({ column, operator: '=', value });
      return this;
    },

    neq(column, value) {
      this._filters.push({ column, operator: '!=', value });
      return this;
    },

    gt(column, value) {
      this._filters.push({ column, operator: '>', value });
      return this;
    },

    gte(column, value) {
      this._filters.push({ column, operator: '>=', value });
      return this;
    },

    lt(column, value) {
      this._filters.push({ column, operator: '<', value });
      return this;
    },

    lte(column, value) {
      this._filters.push({ column, operator: '<=', value });
      return this;
    },

    in(column, values) {
      this._filters.push({ column, operator: 'IN', value: values });
      return this;
    },

    is(column, value) {
      this._filters.push({ column, operator: 'IS', value });
      return this;
    },

    not(column, operator, value) {
      // Special handling for "IS NULL" -> "IS NOT NULL"
      if (operator.toUpperCase() === 'IS' && value === null) {
        this._filters.push({ column, operator: 'IS NOT', value: null });
      } else {
        this._filters.push({ column, operator: `NOT ${operator}`, value });
      }
      return this;
    },

    order(column, options = {}) {
      const direction = options.ascending === false ? 'DESC' : 'ASC';
      this._orderBy = `${column} ${direction}`;
      return this;
    },

    limit(count) {
      this._limit = count;
      return this;
    },

    single() {
      this._single = true;
      this._limit = 1;
      return this;
    },

    async then(resolve, reject) {
      try {
        const result = await this._execute();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    },

    async _execute() {
      const client = await pool.connect();
      
      try {
        let query = '';
        let values = [];
        let valueIndex = 1;

        // Build WHERE clause
        const buildWhereClause = () => {
          if (this._filters.length === 0) return '';
          
          const conditions = this._filters.map(filter => {
            if (filter.operator === 'IN') {
              const placeholders = filter.value.map(() => `$${valueIndex++}`).join(', ');
              values.push(...filter.value);
              return `${filter.column} IN (${placeholders})`;
            } else if (filter.operator === 'IS') {
              return `${filter.column} IS ${filter.value === null ? 'NULL' : 'NOT NULL'}`;
            } else if (filter.operator === 'IS NOT') {
              return `${filter.column} IS NOT NULL`;
            } else {
              values.push(filter.value);
              return `${filter.column} ${filter.operator} $${valueIndex++}`;
            }
          });
          
          return ' WHERE ' + conditions.join(' AND ');
        };

        // Execute based on operation
        if (this._operation === 'insert') {
          // INSERT
          const columns = Object.keys(this._data[0]);
          const rows = this._data.map(row => {
            const rowValues = columns.map(col => {
              let value = row[col];
              
              // Stringify arrays and objects for JSONB columns
              if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                value = JSON.stringify(value);
              }
              
              values.push(value);
              return `$${valueIndex++}`;
            });
            return `(${rowValues.join(', ')})`;
          });

          query = `INSERT INTO ${this._tableName} (${columns.join(', ')}) VALUES ${rows.join(', ')}`;
          
          if (this._selectColumns !== '*') {
            query += ` RETURNING ${this._selectColumns}`;
          } else {
            query += ' RETURNING *';
          }

        } else if (this._operation === 'update') {
          // UPDATE
          const sets = Object.keys(this._data).map(key => {
            let value = this._data[key];
            
            // Stringify arrays and objects for JSONB columns
            // PostgreSQL JSONB columns require stringified JSON
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
              value = JSON.stringify(value);
            }
            
            values.push(value);
            return `${key} = $${valueIndex++}`;
          });

          query = `UPDATE ${this._tableName} SET ${sets.join(', ')}${buildWhereClause()}`;
          
          if (this._selectColumns !== '*') {
            query += ` RETURNING ${this._selectColumns}`;
          } else {
            query += ' RETURNING *';
          }

        } else if (this._operation === 'delete') {
          // DELETE
          query = `DELETE FROM ${this._tableName}${buildWhereClause()}`;

        } else {
          // SELECT
          if (this._head) {
            query = `SELECT COUNT(*) as count FROM ${this._tableName}${buildWhereClause()}`;
          } else {
            query = `SELECT ${this._selectColumns} FROM ${this._tableName}${buildWhereClause()}`;
            
            if (this._orderBy) {
              query += ` ORDER BY ${this._orderBy}`;
            }
            
            if (this._limit) {
              query += ` LIMIT ${this._limit}`;
            }
          }
        }

        const result = await client.query(query, values);

        // Silently execute queries - only log errors
        // console.log('[PostgreSQL] Query executed successfully');
        // console.log('[PostgreSQL] Query:', query);
        // console.log('[PostgreSQL] Values:', values);

        // Format response to match Supabase format
        if (this._single) {
          return {
            data: result.rows[0] || null,
            error: null
          };
        }

        return {
          data: result.rows,
          error: null,
          count: this._count ? result.rowCount : undefined
        };

      } catch (error) {
        console.error('[PostgreSQL] Query error:', error.message);
        console.error('[PostgreSQL] Query:', error.query);
        
        return {
          data: null,
          error: {
            message: error.message,
            code: error.code,
            details: error.detail
          }
        };
      } finally {
        client.release();
      }
    }
  };
}

/**
 * Create a Supabase-compatible client for local PostgreSQL
 * @returns {Object} PostgreSQL client with Supabase-like interface
 */
function createPostgresClient() {
  return {
    from,
    
    // Mock auth.admin interface for local PostgreSQL
    auth: {
      admin: {
        async getUserById(userId) {
          try {
            const pool = getPostgresPool();
            const result = await pool.query(
              'SELECT id, email, name, picture FROM users WHERE id = $1',
              [userId]
            );

            if (result.rows.length === 0) {
              return {
                data: null,
                error: { message: 'User not found' }
              };
            }

            const user = result.rows[0];
            return {
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  user_metadata: {
                    full_name: user.name,
                    name: user.name,
                    picture: user.picture
                  }
                }
              },
              error: null
            };
          } catch (error) {
            console.error('[PostgreSQL] getUserById error:', error.message);
            return {
              data: null,
              error: { message: error.message }
            };
          }
        }
      }
    },
    
    // Close the connection pool
    async close() {
      if (pool) {
        await pool.end();
        pool = null;
        console.log('[PostgreSQL] Connection pool closed');
      }
    }
  };
}

module.exports = {
  getPostgresPool,
  createPostgresClient
};
