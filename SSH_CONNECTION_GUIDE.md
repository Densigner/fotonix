# 🔐 SSH Connection Guide for OVH VPS

## **Step 1: Get Your VPS Password**
1. Log into your OVH Control Panel
2. Go to "Bare Metal Cloud" → "Virtual Private Servers" 
3. Click on your VPS: `vps-603c4873.vps.ovh.net`
4. Look for the root password or reset it if needed

## **Step 2: SSH Connection Commands**

### **Option A: From PowerShell (Windows)**
```powershell
# Connect to your VPS
ssh root@51.75.78.118

# Or using the hostname
ssh root@vps-603c4873.vps.ovh.net
```

### **Option B: Using PuTTY (Windows)**
1. Download PuTTY from: https://putty.org/
2. Host Name: `51.75.78.118` or `vps-603c4873.vps.ovh.net`
3. Port: `22`
4. Connection type: `SSH`
5. Click "Open"
6. Username: `root`
7. Password: [Your VPS password from OVH panel]

### **Option C: Using Windows Subsystem for Linux (WSL)**
```bash
# If you have WSL installed
wsl
ssh root@51.75.78.118
```

## **Step 3: First Time Connection**
When connecting for the first time, you'll see:
```
The authenticity of host '51.75.78.118' can't be established.
ED25519 key fingerprint is SHA256:8oc8+lDHtolfl1KCxy6Yxs+8VH1sEMmMzYLXqoFLkgA.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

**Type: `yes`** and press Enter.

## **Step 4: Upload and Run Setup Script**

Once connected to your VPS:

```bash
# Upload the setup script (run this from your Windows machine)
scp setup-mail-server.sh root@51.75.78.118:/root/

# OR create the file directly on VPS
nano /root/setup-mail-server.sh
# Copy and paste the script content, then save with Ctrl+X, Y, Enter

# Make it executable
chmod +x /root/setup-mail-server.sh

# Run the setup script
./setup-mail-server.sh
```

## **Step 5: Monitor Setup Progress**
The script will:
- ✅ Update Ubuntu 25.04 packages
- ✅ Install Postfix, Dovecot, OpenDKIM
- ✅ Configure mail server settings
- ✅ Create email accounts with random passwords
- ✅ Generate DKIM keys
- ✅ Setup SSL certificates
- ✅ Configure firewall and security

**Setup time**: ~10-15 minutes

## **Step 6: Get Generated Passwords**
After setup completes:
```bash
# View generated email passwords
cat /etc/dovecot/passwd

# Example output:
# noreply@fotonix.co.uk:{PLAIN}Kx9mP2nQ8vL5:5000:8::/var/mail/virtual/fotonix.co.uk/noreply::
# support@fotonix.co.uk:{PLAIN}Rp7dN5yW3hM9:5000:8::/var/mail/virtual/fotonix.co.uk/support::
```

The password is between `{PLAIN}` and the next `:`.

## **Step 7: Get DKIM Key for DNS**
```bash
# View DKIM public key to add to DNS
cat /etc/opendkim/keys/fotonix.co.uk/default.txt
```

## **Troubleshooting SSH Connection**

### **"Permission denied" error:**
- Check your root password in OVH control panel
- Try resetting the VPS password

### **"Connection refused" error:**
- VPS might be starting up - wait 2-3 minutes
- Check VPS status in OVH control panel

### **"Host key verification failed":**
- Delete the old key: `ssh-keygen -R 51.75.78.118`
- Try connecting again

### **Can't find SSH command:**
- Windows 10/11: SSH is built-in to PowerShell
- Older Windows: Install PuTTY or enable SSH in Windows Features

## **Next Steps After Setup**
1. 📋 **Copy the generated passwords** for your email accounts
2. 🔑 **Copy the DKIM public key** to add to DNS
3. 🌐 **Configure DNS records** (A, MX, SPF, DKIM, DMARC)
4. 🧪 **Test email sending** from your website
5. 📊 **Monitor logs** for any issues

## **Useful VPS Commands**
```bash
# Check mail server status
systemctl status postfix dovecot opendkim

# View mail logs
tail -f /var/log/mail.log

# Test SMTP connection
telnet localhost 25

# Test submission port
telnet localhost 587

# Restart services
systemctl restart postfix dovecot opendkim

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
top
```

---

**Ready to connect? Run this command:**
```powershell
ssh root@51.75.78.118
```

Enter your OVH root password when prompted! 🚀