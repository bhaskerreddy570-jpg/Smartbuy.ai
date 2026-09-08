type EnvPresence = {
  AUTH_SECRET: boolean;
  NEXTAUTH_SECRET: boolean;
  AUTH_URL: boolean;
  VERCEL_URL: boolean;
  DATABASE_URL: boolean;
  DATABASE_URL_UNPOOLED: boolean;
  POSTGRES_URL: boolean;
  POSTGRES_URL_NON_POOLING: boolean;
  POSTGRES_PRISMA_URL: boolean;
};

export type AuthSecretSource =
  | 'auth_secret'
  | 'nextauth_secret'
  | 'derived'
  | 'none';

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRuntimeEnv(name: 'AUTH_SECRET' | 'NEXTAUTH_SECRET'): string | undefined {
  // Bracket access avoids build-time inlining of runtime-only Production secrets.
  return trimEnv(process.env[name]);
}

function deriveAuthSecretFromDatabaseUrl(): string | undefined {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return undefined;
  }

  const input = `cloudstorenow-customer-auth-v1:${databaseUrl}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + index), 0x01000193);
  }

  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}${input.length.toString(16)}`
    .padEnd(64, '0')
    .slice(0, 64);
}

export function getEnvPresence(): EnvPresence {
  return {
    AUTH_SECRET: Boolean(readRuntimeEnv('AUTH_SECRET')),
    NEXTAUTH_SECRET: Boolean(readRuntimeEnv('NEXTAUTH_SECRET')),
    AUTH_URL: Boolean(trimEnv(process.env.AUTH_URL)),
    VERCEL_URL: Boolean(trimEnv(process.env.VERCEL_URL)),
    DATABASE_URL: Boolean(trimEnv(process.env.DATABASE_URL)),
    DATABASE_URL_UNPOOLED: Boolean(trimEnv(process.env.DATABASE_URL_UNPOOLED)),
    POSTGRES_URL: Boolean(trimEnv(process.env.POSTGRES_URL)),
    POSTGRES_URL_NON_POOLING: Boolean(trimEnv(process.env.POSTGRES_URL_NON_POOLING)),
    POSTGRES_PRISMA_URL: Boolean(trimEnv(process.env.POSTGRES_PRISMA_URL)),
  };
}

export function resolveAuthSecretWithSource(): {
  secret: string | undefined;
  source: AuthSecretSource;
} {
  const authSecret = readRuntimeEnv('AUTH_SECRET');
  if (authSecret) {
    return { secret: authSecret, source: 'auth_secret' };
  }

  const nextAuthSecret = readRuntimeEnv('NEXTAUTH_SECRET');
  if (nextAuthSecret) {
    return { secret: nextAuthSecret, source: 'nextauth_secret' };
  }

  const derived = deriveAuthSecretFromDatabaseUrl();
  if (derived) {
    return { secret: derived, source: 'derived' };
  }

  return { secret: undefined, source: 'none' };
}

export function resolveAuthSecret(): string | undefined {
  return resolveAuthSecretWithSource().secret;
}

export function resolveAuthUrl(): string | undefined {
  const explicit = trimEnv(process.env.AUTH_URL);
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const vercelUrl = trimEnv(process.env.VERCEL_URL);
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}`;
  }

  return undefined;
}

export function resolveDatabaseUrl(options?: {
  preferDirect?: boolean;
}): string | undefined {
  if (options?.preferDirect) {
    return (
      trimEnv(process.env.DATABASE_URL_UNPOOLED) ??
      trimEnv(process.env.POSTGRES_URL_NON_POOLING) ??
      trimEnv(process.env.DATABASE_URL) ??
      trimEnv(process.env.POSTGRES_URL) ??
      trimEnv(process.env.POSTGRES_PRISMA_URL)
    );
  }

  return (
    trimEnv(process.env.DATABASE_URL) ??
    trimEnv(process.env.POSTGRES_URL) ??
    trimEnv(process.env.POSTGRES_PRISMA_URL) ??
    trimEnv(process.env.DATABASE_URL_UNPOOLED) ??
    trimEnv(process.env.POSTGRES_URL_NON_POOLING)
  );
}

export function requireAuthSecret(): string {
  const secret = resolveAuthSecret();
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }
  return secret;
}

export function requireDatabaseUrl(options?: { preferDirect?: boolean }): string {
  const url = resolveDatabaseUrl(options);
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return url;
}
