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
        // 검색어 토큰화 (공백 기준)
        const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
        
        if (tokens.length === 0) return NextResponse.json({ success: true, items: [] });

        // 모든 토큰이 상품명, 옵션, 상품코드 중 어디든 포함되어야 함
        const whereConditions = tokens.map((_, i) => `("상품명" || ' ' || COALESCE("옵션", '') || ' ' || "상품코드") ILIKE $${i + 1}`).join(' AND ');
        const params = tokens.map(t => `%${t}%`);

        const res = await client.query(`
            SELECT "상품코드", "상품명", "옵션" 
            FROM products 
            WHERE ${whereConditions}
            ORDER BY "업로드일시" DESC NULLS LAST
            LIMIT 50
        `, params);

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
