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

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRuntimeEnv(name: 'AUTH_SECRET' | 'NEXTAUTH_SECRET'): string | undefined {
  // Bracket access avoids build-time inlining of runtime-only Production secrets.
  return trimEnv(process.env[name]);
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

export function resolveAuthSecret(): string | undefined {
  return readRuntimeEnv('AUTH_SECRET') ?? readRuntimeEnv('NEXTAUTH_SECRET');
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
