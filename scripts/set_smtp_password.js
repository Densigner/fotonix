/*
  set_smtp_password.js

  Usage:
    # securely read password from environment variable
    DATABASE_URL='postgresql://...' SMTP_PASSWORD='MyRealPass' node scripts/set_smtp_password.js --tenant=fotonix-prod

    # or pass password on the command line (less secure)
    node scripts/set_smtp_password.js --tenant=fotonix-prod --password='MyRealPass'

  This script updates the password_encrypted column for a tenant's smtp_credentials record.
  It does NOT perform any encryption; it simply stores the provided password string. In production
  you should store secrets in a secrets manager or encrypted in the DB.
*/

const { Client } = require('pg');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = a.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const tenant = args.tenant || args.tenant_slug || 'fotonix-prod';
  const passwordArg = args.password;
  const envPassword = process.env.SMTP_PASSWORD;
  const password = passwordArg || envPassword;

  if (!password) {
    console.error('ERROR: No password provided. Pass --password or set SMTP_PASSWORD in env.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const res = await client.query('SELECT id FROM smtp_credentials WHERE tenant_slug = $1 LIMIT 1', [tenant]);
    if (res.rowCount === 0) {
      console.error(`No smtp_credentials row found for tenant '${tenant}'. Run scripts/setup_smtp_for_tenant.js first.`);
      process.exit(1);
    }

    await client.query('UPDATE smtp_credentials SET password_encrypted = $1, updated_at = now() WHERE tenant_slug = $2', [password, tenant]);
    console.log(`Password set for tenant '${tenant}'.`);
  } catch (err) {
    console.error('Failed to set password:', err.message || err);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
