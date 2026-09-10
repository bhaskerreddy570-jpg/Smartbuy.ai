import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { orm } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const notifications = await orm.Notification.where({ userId: session.user.id })
      .orderBy((n) => n.createdAt.desc())
      .all();
    return NextResponse.json({ notifications: notifications.slice(0, 50) });
  } catch (error) {
    console.error('Failed to load notifications', error);
    return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; markAllRead?: boolean };

  try {
    if (body.markAllRead) {
      const unread = await orm.Notification.where({ userId: session.user.id }).all();
      for (const n of unread) {
        if (!n.readAt) {
          await orm.Notification.where({ id: n.id }).update({ readAt: new Date().toISOString() });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const notification = await orm.Notification.where({ id: body.id, userId: session.user.id }).first();
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await orm.Notification.where({ id: body.id }).update({ readAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update notification', error);
    return NextResponse.json({ error: 'Unable to update notification' }, { status: 500 });
  }
}
