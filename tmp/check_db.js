const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function check() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');

    console.log('Fetching table list...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in public schema:');
    tables.rows.forEach(row => console.log(`- ${row.table_name}`));

    if (tables.rows.length > 0) {
        const firstTable = tables.rows[0].table_name;
        console.log(`\nColumns in table "${firstTable}":`);
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${firstTable}'
        `);
        columns.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
    }

  } catch (err) {
    console.error('Connection Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
