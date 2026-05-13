const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function check() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    console.log('\n--- Searching for 아쿠아-요요 SKUs ---');
    const res = await client.query(`
        SELECT "상품명", "상품코드", "바코드", "옵션" FROM products 
        WHERE "상품명" ILIKE '%아쿠아-요요%' OR "상품코드" ILIKE 'S158561%'
        LIMIT 20
    `);
    
    res.rows.forEach(row => {
        console.log(`[${row.상품코드}] 명칭: ${row.상품명} | 옵션: ${row.옵션}`);
    });

    console.log('\n--- Checking Matching History ---');
    const history = await client.query(`
        SELECT * FROM matching_history 
        WHERE original_style = '아쿠아슈즈-요요' OR matched_name = '아쿠아-요요'
    `);
    history.rows.forEach(h => {
        console.log(`History ID: ${h.id} | Style: ${h.original_style} | Matched: ${h.matched_name} | Code: ${h.product_code} | Color: ${h.color} | Size: ${h.size}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
