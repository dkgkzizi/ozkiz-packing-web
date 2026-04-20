import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.qsqtoufuwplgmzyvzwvd:openhan1234db@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    
    if (!query) return NextResponse.json({ success: true, items: [] });

    const client = await pool.connect();
    try {
        // 검색어 정규화 (한글/영문/숫자만)
        const cleanQuery = query.replace(/[^0-9A-Z가-힣]/gi, '%');
        
        const res = await client.query(`
            SELECT "상품코드", "상품명", "옵션" 
            FROM products 
            WHERE "상품명" ILIKE $1 OR "상품코드" ILIKE $1 
            ORDER BY "업로드일시" DESC NULLS LAST
            LIMIT 50
        `, [`%${cleanQuery}%`]);

        return NextResponse.json({ 
            success: true, 
            items: res.rows.map(r => ({
                productCode: r.상품코드,
                matchedName: r.상품명,
                option: r.옵션
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
