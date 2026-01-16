# VPS Mail Server DNS Configuration
# Current DNS records (Firebase - should be updated):

## Current Records (Firebase):
fotonix.co.uk	TXT	v=spf1 include:_spf.firebasemail.com ~all
fotonix.co.uk	TXT	firebase=fotonix-97544
firebase1._domainkey.fotonix.co.uk	CNAME	mail-fotonix-co-uk.dkim1._domainkey.firebasemail.com.
firebase2._domainkey.fotonix.co.uk	CNAME	mail-fotonix-co-uk.dkim2._domainkey.firebasemail.com.

## Required Records for VPS Mail Server:

### 1. MX Record (Mail Exchange)
fotonix.co.uk	MX	10	mail.fotonix.co.uk

### 2. A Record (Points mail subdomain to VPS IP)
mail.fotonix.co.uk	A	[YOUR_VPS_IP_ADDRESS]

### 3. SPF Record (Updated for VPS)
fotonix.co.uk	TXT	v=spf1 a mx include:mail.fotonix.co.uk ~all

### 4. DMARC Record (Email authentication)
_dmarc.fotonix.co.uk	TXT	v=DMARC1; p=quarantine; rua=mailto:dmarc@fotonix.co.uk

### 5. DKIM Records (if configured on VPS)
# Generate these on your VPS with:
# opendkim-genkey -t -s default -d fotonix.co.uk
default._domainkey.fotonix.co.uk	TXT	[GENERATED_DKIM_PUBLIC_KEY]

### 6. Reverse DNS (PTR Record) - Configure with VPS provider
[YOUR_VPS_IP]	PTR	mail.fotonix.co.uk

## Records to Remove/Update:
- Remove Firebase SPF include
- Remove Firebase DKIM CNAMEs
- Remove Firebase TXT record
- Update SPF to include your VPS

## Testing Commands:
# Test MX record
nslookup -type=MX fotonix.co.uk

# Test SPF record
nslookup -type=TXT fotonix.co.uk

# Test mail server connectivity
telnet mail.fotonix.co.uk 25