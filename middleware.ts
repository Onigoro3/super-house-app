// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/:path*'],
};

export function middleware(req: NextRequest) {
  // パスワード設定（ここを好きなものに変えてください）
  // ユーザー名: user, パスワード: password123
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // ↓↓ ここでIDとパスワードを決めています ↓↓
    if (user === 'onicard2580' && pwd === '25808580') {
      return NextResponse.next();
    }
  }

  url.pathname = '/api/basicauth';

  return new NextResponse('Auth Required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}