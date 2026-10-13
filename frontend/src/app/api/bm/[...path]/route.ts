import { NextRequest, NextResponse } from 'next/server';

const BM_TARGET = 'http://crowncraftinnovations.in:8080';

async function handleRequest(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const pathList = params?.path || [];
    const subPath = pathList.join('/');
    const search = req.nextUrl.search || '';
    const targetUrl = `${BM_TARGET}/${subPath}${search}`;

    const headers: Record<string, string> = {
      'content-type': req.headers.get('content-type') || 'application/json',
      'accept': req.headers.get('accept') || 'application/json, text/plain, */*',
    };

    const auth = req.headers.get('authorization');
    if (auth) {
      headers['authorization'] = auth;
    }

    const options: RequestInit = {
      method: req.method,
      headers,
      cache: 'no-store',
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const bodyText = await req.text();
      if (bodyText) {
        options.body = bodyText;
      }
    }

    const res = await fetch(targetUrl, options);
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Target API connection error: ' + error.message },
      { status: 502 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
