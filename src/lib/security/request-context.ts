export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.headers.get('x-real-ip');
}

export function getRequestUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}
