import NextAuthImport from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { orm } from '@/lib/db';
import { resolveAuthSecret } from '@/lib/server-env';

type AuthConfig = Record<string, unknown>;

const NextAuth = NextAuthImport as (config: AuthConfig | (() => AuthConfig)) => {
  handlers: { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> };
  auth: () => Promise<Session | null>;
  signIn: (...args: unknown[]) => Promise<unknown>;
  signOut: (...args: unknown[]) => Promise<unknown>;
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function buildAuthConfig(): AuthConfig {
  return {
    trustHost: true,
    pages: {
      signIn: '/login',
    },
    session: {
      strategy: 'jwt',
    },
    providers: [
      Credentials({
        name: 'credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        authorize: async (credentials) => {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          const user = await orm.User.where({
            email: parsed.data.email.toLowerCase(),
          })
            .select('id', 'email', 'name', 'passwordHash', 'lockedAt')
            .first();

          if (!user) {
            return null;
          }

          if (user.lockedAt) {
            return null;
          }

          const valid = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
          );

          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }: { token: JWT; user?: { id?: string } | null }) {
        if (user?.id) {
          token.sub = user.id;
        }
        return token;
      },
      session({ session, token }: { session: Session; token: JWT }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
  };
}

// Lazy initialization ensures Auth.js reads runtime env vars when handling each request.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const secret = resolveAuthSecret();
  return {
    ...buildAuthConfig(),
    ...(secret ? { secret } : {}),
  };
});
