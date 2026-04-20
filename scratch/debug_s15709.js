const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkProduct() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM products WHERE "상품코드" = $1', ['S15709']);
        console.log('S15709 Data:', res.rows);
        
        const res2 = await client.query('SELECT * FROM products WHERE "상품명" ILIKE $1 LIMIT 10', ['%하의%']);
        console.log('Items containing "하의":', res2.rows.map(r => r.상품명));

    } finally {
        client.release();
        await pool.end();
    }
}

checkProduct().catch(console.error);
