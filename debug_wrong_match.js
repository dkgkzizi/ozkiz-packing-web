const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    const prodCode = 'S07797';
    const res = await client.query(`
        SELECT * FROM products WHERE "상품코드" = $1 OR "상품명" LIKE $2
    `, [prodCode, '%버블솝%']);
    console.log('Results for 버블솝:', JSON.stringify(res.rows, null, 2));
    await client.end();
}

run().catch(console.error);
