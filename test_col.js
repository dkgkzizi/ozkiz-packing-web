const { Client } = require('pg');
const client = new Client('postgresql://postgres.nndohdshzshymzcvmcvj:A3H_7*tYhJtS.aM@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x');
client.connect().then(() => 
    client.query('SELECT "상품명", "옵션" FROM products LIMIT 1')
        .then(r => console.log(r.rows))
        .catch(e => console.log('ERROR:', e.message))
        .finally(() => client.end())
);
