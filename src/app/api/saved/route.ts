import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { orm } from '@/lib/db';

const saveSchema = z.object({
  productId: z.string().uuid(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const saved = await orm.SavedProduct.where({ userId: session.user.id }).all();
    const products = [];
    for (const item of saved) {
      const product = await orm.Product.where({ id: item.productId }).first();
      if (product) products.push(product);
    }
    return NextResponse.json({ saved, products });
  } catch (error) {
    console.error('Failed to load saved products', error);
    return NextResponse.json({ error: 'Unable to load saved products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    const product = await orm.Product.where({ id: parsed.data.productId }).first();
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existing = await orm.SavedProduct.where({
      userId: session.user.id,
      productId: parsed.data.productId,
    }).first();

    if (existing) {
      return NextResponse.json({ saved: existing });
    }

    const saved = await orm.SavedProduct.create({
      userId: session.user.id,
      productId: parsed.data.productId,
    });

    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    console.error('Failed to save product', error);
    return NextResponse.json({ error: 'Unable to save product' }, { status: 500 });
  }
}
