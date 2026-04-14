const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const q = `SELECT "상품코드", "상품명", "업로드일시" FROM products WHERE "상품명" != "상품코드" LIMIT 20`;
    const res = await pool.query(q);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
