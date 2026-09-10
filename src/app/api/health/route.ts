import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'smartbuy-ai',
    timestamp: new Date().toISOString(),
  });
}
