const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    // 스타일 번호로 검색 시도
    const style = 'O25WE03U';
    const res = await client.query(`
        SELECT * FROM products 
        WHERE "상품코드" ILIKE $1 
           OR "바코드" ILIKE $1 
           OR "상품명" ILIKE $1
        LIMIT 5
    `, [`%${style}%`]);
    console.log('Search Results for', style, ':', JSON.stringify(res.rows, null, 2));
    await client.end();
}

run().catch(console.error);
