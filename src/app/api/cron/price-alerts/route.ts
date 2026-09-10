import { NextResponse } from 'next/server';
import { runPriceAlertWorker } from '@/lib/workers/price-alert-worker';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runPriceAlertWorker();
  return NextResponse.json({ ok: true, result });
}

export async function GET(request: Request) {
  return POST(request);
}
