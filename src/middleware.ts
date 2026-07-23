import { NextRequest, NextResponse } from 'next/server';

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  const wantsPc = req.nextUrl.searchParams.get('pc') === '1';

  if (MOBILE_UA.test(ua) && !wantsPc) {
    return NextResponse.redirect(new URL('/domestic-mobile', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
