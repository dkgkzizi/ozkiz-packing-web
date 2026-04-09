import { NextRequest, NextResponse } from 'next/server';
import { matchExcelBuffer } from '@/lib/matcher';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('excel') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = await matchExcelBuffer(buffer);

    const excelBuffer = await workbook.xlsx.writeBuffer();

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Matched_Result_${Date.now()}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Matching Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
