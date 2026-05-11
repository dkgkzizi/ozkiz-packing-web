const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
    const client = await pool.connect();
    try {
        console.log('Sample Options:');
        const resOpt = await client.query('SELECT "옵션" FROM products WHERE "옵션" IS NOT NULL LIMIT 50');
        console.log(resOpt.rows.map(r => r.옵션));

        console.log('\nSample Product Codes & Barcodes:');
        const resCode = await client.query('SELECT "상품코드", "바코드" FROM products LIMIT 50');
        resCode.rows.forEach(r => console.log(`${r.상품코드} | ${r.바코드}`));
    } finally {
        client.release();
        await pool.end();
    }
}

analyze().catch(console.error);
