const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function check() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query('SELECT count(*) FROM products');
    console.log('Total products count:', result.rows[0].count);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
