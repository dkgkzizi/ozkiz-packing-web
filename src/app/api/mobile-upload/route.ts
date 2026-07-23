import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'domestic';

    if (!file) return NextResponse.json({ success: false, message: '파일 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO mobile_uploads (category, file_name, mime_type, image_data)
         VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [category, file.name || `capture_${Date.now()}.jpg`, file.type || 'image/jpeg', buffer]
      );
      return NextResponse.json({ success: true, id: res.rows[0].id, created_at: res.rows[0].created_at });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('MOBILE_UPLOAD_POST_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '업로드 중 오류' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'domestic';

    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, file_name, created_at FROM mobile_uploads WHERE category = $1 ORDER BY created_at ASC`,
        [category]
      );
      return NextResponse.json({ success: true, items: res.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('MOBILE_UPLOAD_GET_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '조회 중 오류' }, { status: 500 });
  }
}
