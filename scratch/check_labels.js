const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkLabels() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM products WHERE "상품명" ILIKE $1 OR "상품명" ILIKE $2 LIMIT 20', ['%라벨%', '%보증택%']);
        console.log('Label/Tag Items in DB:', res.rows.map(r => ({ code: r.상품코드, name: r.상품명, option: r.옵션 })));

        const res2 = await client.query('SELECT * FROM products WHERE "상품명" ILIKE $1', ['%하의라벨%']);
        console.log('Exact Match for "하의라벨":', res2.rows);

    } finally {
        client.release();
        await pool.end();
    }
}

checkLabels().catch(console.error);
