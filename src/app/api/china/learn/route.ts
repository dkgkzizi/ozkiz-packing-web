import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { originalStyle, matchedName, productCode } = await req.json();

        if (!originalStyle || !productCode) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // Upsert: 이미 있는 스타일이면 업데이트, 없으면 삽입
            await client.query(`
                INSERT INTO matching_history (original_style, matched_name, product_code)
                VALUES ($1, $2, $3)
                ON CONFLICT (original_style) 
                DO UPDATE SET matched_name = EXCLUDED.matched_name, product_code = EXCLUDED.product_code
            `, [originalStyle, matchedName, productCode]);

            return NextResponse.json({ success: true, message: 'Learned successfully' });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('LEARN_ERROR:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
