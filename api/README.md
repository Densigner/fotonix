Fotonix API (Express)

Quick start:

1. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.
2. Start Postgres (docker-compose):

```bash
docker-compose up -d
```

3. Install deps and migrate/seed:

```bash
npm install
npm run migrate
npm run seed
```

4. Start server:

```bash
npm run dev
```

API endpoints:
- POST /reviews/:id/helpful { vote: 'up'|'down'|'clear' }
- GET  /reviews/:id/helpful
