const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testSearch() {
    const client = await pool.connect();
    try {
        const query = '모기';
        const tokens = [query];
        const whereConditions = tokens.map((_, i) => `REPLACE("상품명" || COALESCE("옵션", '') || "상품코드", ' ', '') ILIKE $${i + 1}`).join(' AND ');
        const params = tokens.map(t => `%${t.replace(/\s+/g, '')}%`);

        console.log('SQL:', `SELECT "상품코드", "상품명", "옵션" FROM products WHERE ${whereConditions} LIMIT 5`);
        console.log('Params:', params);

        const res = await client.query(`
            SELECT "상품코드", "상품명", "옵션" 
            FROM products 
            WHERE ${whereConditions}
            LIMIT 5
        `, params);

        console.log('Results Count:', res.rows.length);
        res.rows.forEach(r => console.log(r));

    } finally {
        client.release();
        await pool.end();
    }
}

testSearch().catch(console.error);
