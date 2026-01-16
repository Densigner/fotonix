## Fotonix Email (Demo)

### Prereqs
- Node 20+
- Docker with Postgres and (optional) Mailhog or any SMTP (host/port)

### Env
Set DATABASE_URL, e.g. PowerShell:
$env:DATABASE_URL='postgres://pguser:pgpass@localhost:5432/fotonix_test'

### Setup
npm install
npm run migrate
npm run seed:email
npm run dev

### Test send
POST http://localhost:3000/api/email/send
{
	"tenant_slug": "fotonix-demo",
	"to": "you@example.com",
	"template_name": "welcome",
	"template_vars": { "name": "Jamie" }
}
It correctly bundles React in production mode and optimizes the build for the best performance.
