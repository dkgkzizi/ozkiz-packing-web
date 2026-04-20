import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    
    if (!query) return NextResponse.json({ success: true, items: [] });

    const client = await pool.connect();
    try {
        // 검색어 토큰화 (공백 기준)
        const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
        
        if (tokens.length === 0) return NextResponse.json({ success: true, items: [] });

        // 모든 토큰이 상품명, 옵션, 상품코드 중 어디든 포함되어야 함 (공백 무시 검색)
        // CONCAT을 사용하여 NULL 부작용 방지
        const whereConditions = tokens.map((_, i) => `REPLACE(CONCAT("상품명", "옵션", "상품코드"), ' ', '') ILIKE $${i + 1}`).join(' AND ');
        const params = tokens.map(t => `%${t.replace(/\s+/g, '')}%`);

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
