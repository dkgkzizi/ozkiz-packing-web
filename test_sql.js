const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    const patterns = ['%O25WE03U%'];
    const res = await client.query(`
        SELECT count(*) FROM products 
        WHERE "상품코드" ILIKE ANY($1) 
           OR "바코드" ILIKE ANY($1) 
           OR "상품명" ILIKE ANY($1)
    `, [patterns]);
    console.log('Count with ANY:', res.rows[0].count);
    await client.end();
}

run().catch(console.error);
