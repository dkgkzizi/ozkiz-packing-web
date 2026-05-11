const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log('--- Table: products ---');
        const tableInfo = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        console.log('Columns:', tableInfo.rows.map(r => r.column_name).join(', '));

        console.log('\n--- Sample Data (5 rows) ---');
        const sampleData = await client.query('SELECT * FROM products LIMIT 5');
        console.log(JSON.stringify(sampleData.rows, null, 2));
        
        console.log('\n--- Searching for a specific style (e.g. S07797 from debug script) ---');
        const searchRes = await client.query('SELECT * FROM products WHERE "상품코드" = $1 OR "상품명" LIKE $2 LIMIT 5', ['S07797', '%버블솝%']);
        console.log('Search Results:', JSON.stringify(searchRes.rows, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSchema();
