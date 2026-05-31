import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

const isExternalDb = 
  connectionString.includes('supabase') || 
  connectionString.includes('elephantsql') || 
  connectionString.includes('render');

// Prevent multiple Pool instances in Next.js development hot-reloading
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool = globalForDb.pool ?? new Pool({
  connectionString,
  ssl: isExternalDb ? { rejectUnauthorized: false } : false,
  max: 5, // Lower connection count to avoid Supabase connection limit exhaustion
  idleTimeoutMillis: 10000, // Release idle connections back after 10 seconds
  connectionTimeoutMillis: 30000, // Safe 30-second timeout to support cold starts
});

// Handle background idle client errors to prevent unhandled connection reset crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return res;
}

