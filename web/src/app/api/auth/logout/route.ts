import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  
  // Delete all auth cookies by setting maxAge: 0
  cookieStore.set('access_token', '', { maxAge: 0, path: '/' });
  cookieStore.set('refresh_token', '', { maxAge: 0, path: '/' });
  cookieStore.set('user', '', { maxAge: 0, path: '/' });

  return NextResponse.json({ success: true });
}
