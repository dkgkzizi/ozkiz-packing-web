const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres.nndohdshzshymzcvmcvj:A3H_7*tYhJtS.aM@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?supa=base-pooler.x',
    ssl: { rejectUnauthorized: false }
});
client.connect().then(() => 
    client.query(`SELECT "상품코드", "상품명", "바코드" FROM products WHERE "상품명" ILIKE '%체크보더%' LIMIT 10`)
        .then(r => console.log(r.rows))
        .catch(e => console.log('ERROR:', e.message))
        .finally(() => client.end())
);
