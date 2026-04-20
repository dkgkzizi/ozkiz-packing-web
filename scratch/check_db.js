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
        const res = await client.query('SELECT "상품코드", "상품명" FROM products LIMIT 10');
        console.log('Sample Products:', res.rows);
        
        const countRes = await client.query('SELECT COUNT(*) FROM products');
        console.log('Total Products:', countRes.rows[0].count);

        const searchRes = await client.query('SELECT "상품코드", "상품명" FROM products WHERE "상품명" LIKE \'%눈부신%\' OR "상품명" LIKE \'%리본%\'');
        console.log('Search Result:', searchRes.rows);
    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);
