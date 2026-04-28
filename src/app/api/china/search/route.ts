import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    
    if (!query) return NextResponse.json({ success: true, items: [] });

    const client = await pool.connect();
    try {
        // 검색어 토큰화 (단순 ILIKE 검색으로 성능 최적화)
        const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
        
        if (tokens.length === 0) return NextResponse.json({ success: true, items: [] });

        const whereConditions = tokens.map((_, i) => `("상품명" ILIKE $${i + 1} OR "상품코드" ILIKE $${i + 1} OR "바코드" ILIKE $${i + 1})`).join(' AND ');
        const params = tokens.map(t => `%${t}%`);

        const res = await client.query(`
            SELECT "상품코드", "상품명", "바코드" 
            FROM products 
            WHERE ${whereConditions}
            ORDER BY 
                (CASE 
                    WHEN "상품명" = $${tokens.length + 1} THEN 0
                    WHEN "상품명" ILIKE $${tokens.length + 1} THEN 1
                    WHEN "상품코드" = $${tokens.length + 1} THEN 0
                    ELSE 2 
                END),
                LENGTH("상품명") ASC,
                "업로드일시" DESC NULLS LAST
            LIMIT 50
        `, [...params, query]);

        return NextResponse.json({ 
            success: true, 
            items: res.rows.map(r => ({
                productCode: r.상품코드,
                matchedName: r.상품명,
                option: r.바코드
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
