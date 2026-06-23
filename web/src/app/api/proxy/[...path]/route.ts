import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

async function handleProxy(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const resolvedPath = path.join('/');
    const { search } = request.nextUrl;
    const backendUrl = `http://localhost:3000/${resolvedPath}${search}`;

    const cookieStore = await cookies();
    let accessToken = cookieStore.get('access_token')?.value;

    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    const method = request.method;
    let body: any = null;

    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      try {
        body = await request.text();
      } catch (err) {
        // No body or error reading it
      }
    }

    let response = await fetch(backendUrl, {
      method,
      headers: requestHeaders,
      body: body || undefined,
    });

    // Handle 401 Unauthorized - Attempt Automatic Refresh
    if (response.status === 401) {
      console.log(`Access token expired. Attempting token refresh for path: ${resolvedPath}`);
      const refreshToken = cookieStore.get('refresh_token')?.value;

      if (refreshToken) {
        try {
          const refreshRes = await fetch('http://localhost:3000/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccessToken = refreshData.accessToken;

            // Update cookie in the background/client
            cookieStore.set('access_token', newAccessToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 15 * 60,
              path: '/',
            });

            // Retry original request with the new token
            requestHeaders['Authorization'] = `Bearer ${newAccessToken}`;
            response = await fetch(backendUrl, {
              method,
              headers: requestHeaders,
              body: body || undefined,
            });
            console.log('Successfully refreshed token and retried proxy request.');
          } else {
            console.warn('Token refresh failed at backend. User must log in again.');
            // Clear expired cookies
            cookieStore.set('access_token', '', { maxAge: 0, path: '/' });
            cookieStore.set('refresh_token', '', { maxAge: 0, path: '/' });
            cookieStore.set('user', '', { maxAge: 0, path: '/' });
          }
        } catch (refreshErr) {
          console.error('Error during token refresh execution:', refreshErr);
        }
      }
    }

    const dataText = await response.text();
    let data;
    try {
      data = JSON.parse(dataText);
    } catch {
      data = dataText;
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { message: 'Failed to connect to backend service' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, options: RouteParams) {
  return handleProxy(request, options);
}

export async function POST(request: NextRequest, options: RouteParams) {
  return handleProxy(request, options);
}

export async function PATCH(request: NextRequest, options: RouteParams) {
  return handleProxy(request, options);
}

export async function DELETE(request: NextRequest, options: RouteParams) {
  return handleProxy(request, options);
}
