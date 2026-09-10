import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { orm } from '@/lib/db';

const createSchema = z.object({
  productId: z.string().uuid(),
  targetPrice: z.number().positive(),
  merchantId: z.string().uuid().optional(),
  currency: z.string().default('INR'),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const alerts = await orm.PriceAlert.where({ userId: session.user.id })
      .orderBy((a) => a.createdAt.desc())
      .all();
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Failed to load alerts', error);
    return NextResponse.json({ error: 'Unable to load alerts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid alert data' }, { status: 400 });
    }

    const product = await orm.Product.where({ id: parsed.data.productId }).first();
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const alert = await orm.PriceAlert.create({
      userId: session.user.id,
      productId: parsed.data.productId,
      merchantId: parsed.data.merchantId ?? null,
      targetPrice: String(parsed.data.targetPrice),
      currency: parsed.data.currency,
      status: 'ACTIVE',
      notificationChannel: 'EMAIL',
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Failed to create alert', error);
    return NextResponse.json({ error: 'Unable to create alert' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get('id');
  if (!alertId) {
    return NextResponse.json({ error: 'Alert id required' }, { status: 400 });
  }

  try {
    const alert = await orm.PriceAlert.where({ id: alertId, userId: session.user.id }).first();
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    await orm.PriceAlert.where({ id: alertId }).update({ status: 'CANCELLED' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel alert', error);
    return NextResponse.json({ error: 'Unable to cancel alert' }, { status: 500 });
  }
}
