const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function check() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('\nColumns in table "products":');
    const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'products'
    `);
    columns.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));

    console.log('\nSample data from "products":');
    const data = await client.query(`SELECT * FROM products LIMIT 1`);
    console.log(data.rows[0]);

  } catch (err) {
    console.error('Connection Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
