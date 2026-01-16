const dns = require('dns');

async function checkCurrentDNS() {
  console.log('🔍 Checking current DNS configuration for fotonix.co.uk...\n');

  try {
    // Check MX records
    console.log('📧 MX Records:');
    const mx = await new Promise((resolve, reject) => {
      dns.resolveMx('fotonix.co.uk', (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    mx.forEach(record => {
      console.log(`  Priority: ${record.priority}, Exchange: ${record.exchange}`);
    });
  } catch (error) {
    console.log('  No MX records found or error:', error.message);
  }

  try {
    // Check TXT records (SPF, DMARC, etc.)
    console.log('\n📝 TXT Records:');
    const txt = await new Promise((resolve, reject) => {
      dns.resolveTxt('fotonix.co.uk', (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    txt.forEach(record => {
      const recordStr = Array.isArray(record) ? record.join('') : record;
      console.log(`  ${recordStr}`);
    });
  } catch (error) {
    console.log('  No TXT records found or error:', error.message);
  }

  try {
    // Check A record for mail subdomain
    console.log('\n🌐 A Record for mail.fotonix.co.uk:');
    const mailA = await new Promise((resolve, reject) => {
      dns.resolve4('mail.fotonix.co.uk', (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    mailA.forEach(addr => {
      console.log(`  ${addr}`);
    });
  } catch (error) {
    console.log('  No A record found or error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 RECOMMENDED DNS CHANGES:');
  console.log('='.repeat(60));
  console.log('');
  console.log('🔄 UPDATE these records in your DNS provider:');
  console.log('');
  console.log('1. SPF Record (UPDATE existing):');
  console.log('   fotonix.co.uk  TXT  "v=spf1 a mx include:mail.fotonix.co.uk ~all"');
  console.log('');
  console.log('2. MX Record (ADD if missing):');
  console.log('   fotonix.co.uk  MX   10 mail.fotonix.co.uk');
  console.log('');
  console.log('3. DMARC Record (ADD):');
  console.log('   _dmarc.fotonix.co.uk  TXT  "v=DMARC1; p=quarantine; rua=mailto:admin@fotonix.co.uk"');
  console.log('');
  console.log('❌ REMOVE these Firebase records:');
  console.log('   - v=spf1 include:_spf.firebasemail.com ~all');
  console.log('   - firebase=fotonix-97544');
  console.log('   - firebase1._domainkey.fotonix.co.uk CNAME');
  console.log('   - firebase2._domainkey.fotonix.co.uk CNAME');
  console.log('');
  console.log('⚡ After DNS changes, allow 24-48 hours for propagation');
}

checkCurrentDNS();