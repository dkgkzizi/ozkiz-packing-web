import pg from 'pg';
const { Pool } = pg;

// Supabase Connection Pooling (Transaction Mode)
// 포트를 5432(Session)에서 6543(Transaction)으로 변경하여 동시 접속 제한 해소
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1 // 서버리스 환경에서는 인스턴스당 1개의 연결만 유지하도록 제한 (커넥션 부족 에러 방지)
});

export default pool;
