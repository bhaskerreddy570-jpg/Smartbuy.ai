import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminLogin } from '@/lib/admin/login';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  mfaCode: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid login request' }, { status: 400 });
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    const result = await authenticateAdminLogin({
      email: parsed.data.email,
      password: parsed.data.password,
      ipAddress,
      userAgent,
      mfaCode: parsed.data.mfaCode,
    });

    if (!result.ok) {
      const status =
        result.reason === 'rate_limited'
          ? 429
          : result.reason === 'locked'
            ? 423
            : 401;

      return NextResponse.json(
        { error: 'Invalid admin credentials or access denied' },
        { status },
      );
    }

    return NextResponse.json(
      {
        admin: result.admin,
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': result.cookie,
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to sign in' }, { status: 500 });
  }
}
