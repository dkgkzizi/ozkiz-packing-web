const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const codes = ['S00429', 'S158316', 'S158317'];
        console.log(`--- Checking wrong matches ${codes} ---`);
        const res = await pool.query('SELECT "상품코드", "상품명", "옵션", "바코드" FROM products WHERE "상품코드" = ANY($1)', [codes]);
        console.log('Results:', JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
