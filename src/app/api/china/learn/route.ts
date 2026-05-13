import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { originalStyle, matchedName, productCode, color, size } = await req.json();

        if (!originalStyle || !productCode) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO matching_history (original_style, matched_name, product_code, color, size)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (original_style, color, size) 
                DO UPDATE SET matched_name = EXCLUDED.matched_name, product_code = EXCLUDED.product_code
            `, [originalStyle, matchedName, productCode, color || '', size || '']);

            return NextResponse.json({ success: true, message: 'Learned successfully' });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('LEARN_ERROR:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
