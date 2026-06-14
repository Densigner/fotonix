# 🚀 FOTONIX WEBSITE DEPLOYMENT

## Quick Reference
- **Website URL:** https://www.fotonix.co.uk
- **Website Server IP:** 91.238.164.175
- **Hosting User:** fotonixc
- **Web Root:** ~/public_html (symlinked to ~/www)
- **Source Code:** ~/fotonix-repo (cloned from GitHub)
- **GitHub Repo:** https://github.com/Densigner/fotonix.git

## Two Servers - Don't Confuse Them!

| Server | IP | Purpose |
|--------|-----|---------|
| **Website Host** | 91.238.164.175 | Frontend (www.fotonix.co.uk) |
| **API VPS** | 178.104.153.63 | Backend API server |

## How to Deploy Changes to www.fotonix.co.uk

### Step 1: Push changes to GitHub (from your PC)
```powershell
cd "c:\Users\joshm\Desktop\fotonix.co.uk\fotonix.co.uk"
git add .
git commit -m "describe your changes"
git push
```

### Step 2: Deploy on server
1. Open terminal on website hosting (via cPanel or SSH)
2. Run the deploy script:
```bash
~/deploy.sh
```

That's it! The script handles: git pull → npm install → npm run build → copy to public_html

## Deploy Script Location
The deploy script is at `~/deploy.sh` on the website server.

### Deploy Script Contents:
```bash
#!/bin/bash
cd ~/fotonix-repo
git pull
npm install
npm run build
cp -r build/* ~/public_html/
echo "✅ Deployed!"
```

## Server Access

### Website Hosting (for frontend)
- **Access via:** cPanel Terminal (SSH port 22 is blocked externally)
- **Home directory:** /home/fotonixc
- **SSH key generated:** ~/.ssh/id_rsa (SHA256:jVt7VVxghgq60yrJn9jJfuSJbLjQd0dbNzGemSkniJY)

### API VPS (for backend)
- **SSH:** `ssh root@178.104.153.63`
- **Deploy script:** `.\deploy-to-vps.ps1` (on local PC)

## File Structure on Website Server

```
/home/fotonixc/
├── fotonix-repo/          # Full source code (git clone)
│   ├── src/               # React source
│   ├── build/             # Built files (generated)
│   ├── package.json
│   └── ...
├── public_html/           # LIVE website files (copied from build/)
│   ├── index.html
│   ├── static/
│   └── ...
├── www -> public_html     # Symlink
└── deploy.sh              # One-command deploy script
```

## Troubleshooting

### "npm: command not found"
Node.js may not be installed or in PATH. Check with hosting provider.

### Build fails
Run manually to see errors:
```bash
cd ~/fotonix-repo
npm install
npm run build
```

### Changes not showing on website
- Clear browser cache (Ctrl+Shift+R)
- Check if build completed successfully
- Verify files copied: `ls -la ~/public_html/`

## Environment Variables
The frontend uses REACT_APP_ prefixed env vars. These are baked in at BUILD time, not runtime.
Key ones in .env:
- `REACT_APP_PUBLIC_URL=https://fotonix.co.uk`
- `REACT_APP_DOMAIN=https://fotonix.co.uk`
