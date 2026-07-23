import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT file_name, mime_type, image_data FROM mobile_uploads WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, message: '이미 처리되었거나 존재하지 않는 항목입니다.' }, { status: 404 });
      }
      const row = res.rows[0];
      return new NextResponse(row.image_data, {
        headers: {
          'Content-Type': row.mime_type || 'image/jpeg',
          'Content-Disposition': `inline; filename="${encodeURIComponent(row.file_name || 'capture.jpg')}"`,
        },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('MOBILE_UPLOAD_GET_ONE_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '조회 중 오류' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM mobile_uploads WHERE id = $1`, [id]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('MOBILE_UPLOAD_DELETE_ERROR:', err);
    return NextResponse.json({ success: false, message: err.message || '삭제 중 오류' }, { status: 500 });
  }
}
