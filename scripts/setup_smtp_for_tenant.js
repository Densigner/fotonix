/*
  setup_smtp_for_tenant.js

  Usage: node scripts/setup_smtp_for_tenant.js --tenant=YOUR_TENANT_SLUG --host=mail.enmail.co --port=465 --username=support@fotonix.co.uk --from=no-reply@fotonix.co.uk --secure=true

  This script connects to the database using DATABASE_URL from env and inserts/updates a row in smtp_credentials.
  It purposefully leaves the password_encrypted empty so you can set it separately (via set_smtp_password.js or env).

  Notes:
  - Make sure DATABASE_URL is set in your environment before running.
  - This file does NOT create a mailbox on the host. If you want to automate mailbox creation via cPanel, see the commented snippet at the bottom and run it separately.
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
  const host = args.host || 'mail.enmail.co';
  const port = args.port ? parseInt(args.port, 10) : 465;
  const username = args.username || '';
  const secure = (args.secure === 'true' || args.secure === true) ? true : false;
  const fromAddress = args.from || args.from_address || 'noreply@fotonix.co.uk';

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Try upsert by tenant_slug. Adjust column names if your schema differs.
    const upsertSql = `
      INSERT INTO smtp_credentials (tenant_slug, host, port, username, password_encrypted, secure, from_address, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      ON CONFLICT (tenant_slug) DO UPDATE
      SET host = EXCLUDED.host,
          port = EXCLUDED.port,
          username = EXCLUDED.username,
          secure = EXCLUDED.secure,
          from_address = EXCLUDED.from_address,
          updated_at = now();
    `;

    // Leave password_encrypted empty (NULL) so you can set it separately.
    await client.query(upsertSql, [tenant, host, port, username || null, null, secure, fromAddress]);

    console.log(`SMTP credentials inserted/updated for tenant: ${tenant}`);
    console.log(` host=${host} port=${port} username=${username} secure=${secure} from_address=${fromAddress}`);
    console.log(`Password intentionally left blank. Use scripts/set_smtp_password.js to set it securely later.`);
  } catch (err) {
    console.error('Failed to upsert smtp_credentials:', err.message || err);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });


// Optional: cPanel mailbox creation snippet (commented)
// If you want to programmatically create a mailbox via cPanel's UAPI, you can use axios or fetch
// with Basic auth. This code is intentionally commented out and provided for your convenience.

/*
const axios = require('axios');

async function createMailboxViaCpanel({ cpanelHost, cpanelUser, cpanelPass, localPart, domain = 'fotonix.co.uk', quota = 250 }) {
  const authHeader = Buffer.from(`${cpanelUser}:${cpanelPass}`).toString('base64');
  try {
    const res = await axios.get(`${cpanelHost}/execute/Email/add_pop`, {
      headers: { Authorization: `Basic ${authHeader}` },
      params: { domain, email: localPart, password: 'YOUR_PASSWORD_HERE', quota }
    });
    console.log('cPanel response:', res.data);
  } catch (err) {
    console.error('cPanel mailbox creation failed:', err.response?.data || err.message);
  }
}
*/
