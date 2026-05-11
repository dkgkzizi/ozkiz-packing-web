const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('--- Sample Options ---');
        const res = await pool.query('SELECT "옵션" FROM products WHERE "옵션" IS NOT NULL LIMIT 20');
        console.log(res.rows.map(r => r.옵션));

        console.log('\n--- Searching for 블랙 and 100 ---');
        const res2 = await pool.query('SELECT "상품코드", "상품명", "옵션" FROM products WHERE "옵션" ILIKE $1 AND "옵션" ILIKE $2 LIMIT 5', ['%블랙%', '%100%']);
        console.log('Results (블랙/100):', JSON.stringify(res2.rows, null, 2));

        console.log('\n--- Searching for "TOP AND BTM" as name ---');
        const res3 = await pool.query('SELECT "상품코드", "상품명", "옵션" FROM products WHERE "상품명" ILIKE $1 LIMIT 5', ['%TOP%']);
        console.log('Results (TOP):', JSON.stringify(res3.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
