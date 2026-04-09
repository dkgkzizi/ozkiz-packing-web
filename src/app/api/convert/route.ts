import { NextRequest, NextResponse } from 'next/server';
import { parsePdfBuffer } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = await parsePdfBuffer(buffer);

    // Convert workbook to buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Packing_List_${Date.now()}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Conversion Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
