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
        console.log('\n--- Searching for "모기" with Options ---');
        const searchRes = await client.query('SELECT "상품코드", "상품명", "옵션" FROM products WHERE "상품명" LIKE \'%모기%\' OR "옵션" LIKE \'%모기%\'');
        searchRes.rows.forEach(r => console.log(r));

    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);
