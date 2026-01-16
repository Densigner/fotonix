/**
 * Check mail server configuration via SSH
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkMailServer() {
  console.log('🔍 Checking Mail Server Configuration\n');
  
  const checks = [
    {
      name: 'Postfix Status',
      command: 'ssh root@51.75.78.118 "systemctl status postfix | head -n 5"'
    },
    {
      name: 'Dovecot (IMAP) Status',
      command: 'ssh root@51.75.78.118 "systemctl status dovecot | head -n 5"'
    },
    {
      name: 'Virtual Mailboxes',
      command: 'ssh root@51.75.78.118 "cat /etc/postfix/virtual 2>/dev/null | head -n 20"'
    },
    {
      name: 'IMAP Enabled?',
      command: 'ssh root@51.75.78.118 "doveconf protocols 2>/dev/null"'
    },
    {
      name: 'Mail Domains',
      command: 'ssh root@51.75.78.118 "postconf virtual_mailbox_domains 2>/dev/null"'
    }
  ];

  for (const check of checks) {
    console.log(`\n📋 ${check.name}`);
    console.log('─'.repeat(50));
    try {
      const { stdout, stderr } = await execPromise(check.command);
      console.log(stdout || stderr || '(empty)');
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }
  }
}

checkMailServer().catch(console.error);
