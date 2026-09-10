# Deployment

## Environment variables

See `.env.example`. Required:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`

## Build

```bash
npm run build
npm start
```

## Health check

```
GET /api/health
```

## Database migrations

```bash
npm run contract:emit
npm run db:migrate
```

## Docker (optional)

```bash
docker compose up -d
```

## Vercel

Set environment variables in dashboard. Build command: `npm run build`.
