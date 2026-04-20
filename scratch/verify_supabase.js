const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function check() {
    const client = await pool.connect();
    try {
        console.log('--- Checking Column Names ---');
        const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
        console.log('Columns:', colRes.rows.map(r => r.column_name));

        console.log('\n--- Searching for "모기" ---');
        const searchRes = await client.query('SELECT "상품코드", "상품명" FROM products WHERE "상품명" LIKE \'%모기%\'');
        console.log('Search Result (모기):', searchRes.rows);

        console.log('\n--- Searching for "눈부신" ---');
        const searchRes2 = await client.query('SELECT "상품코드", "상품명" FROM products WHERE "상품명" LIKE \'%눈부신%\'');
        console.log('Search Result (눈부신):', searchRes2.rows);

    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);
