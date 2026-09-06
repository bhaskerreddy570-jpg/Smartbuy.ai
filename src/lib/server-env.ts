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

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getEnvPresence(): EnvPresence {
  return {
    AUTH_SECRET: Boolean(readEnv('AUTH_SECRET')),
    NEXTAUTH_SECRET: Boolean(readEnv('NEXTAUTH_SECRET')),
    AUTH_URL: Boolean(readEnv('AUTH_URL')),
    VERCEL_URL: Boolean(readEnv('VERCEL_URL')),
    DATABASE_URL: Boolean(readEnv('DATABASE_URL')),
    DATABASE_URL_UNPOOLED: Boolean(readEnv('DATABASE_URL_UNPOOLED')),
    POSTGRES_URL: Boolean(readEnv('POSTGRES_URL')),
    POSTGRES_URL_NON_POOLING: Boolean(readEnv('POSTGRES_URL_NON_POOLING')),
    POSTGRES_PRISMA_URL: Boolean(readEnv('POSTGRES_PRISMA_URL')),
  };
}

export function resolveAuthSecret(): string | undefined {
  return readEnv('AUTH_SECRET') ?? readEnv('NEXTAUTH_SECRET');
}

export function resolveAuthUrl(): string | undefined {
  const explicit = readEnv('AUTH_URL');
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const vercelUrl = readEnv('VERCEL_URL');
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
      readEnv('DATABASE_URL_UNPOOLED') ??
      readEnv('POSTGRES_URL_NON_POOLING') ??
      readEnv('DATABASE_URL') ??
      readEnv('POSTGRES_URL') ??
      readEnv('POSTGRES_PRISMA_URL')
    );
  }

  return (
    readEnv('DATABASE_URL') ??
    readEnv('POSTGRES_URL') ??
    readEnv('POSTGRES_PRISMA_URL') ??
    readEnv('DATABASE_URL_UNPOOLED') ??
    readEnv('POSTGRES_URL_NON_POOLING')
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
