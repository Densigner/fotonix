# Windows Node setup (nvm-windows)

Recommended: use nvm for Windows to manage Node versions cleanly.

1) Remove old Node (if any)
- Open Settings -> Apps & features
- If Node.js is installed from nodejs.org, uninstall it here (only do this if you previously installed Node through the official installer).

2) Install nvm for Windows
- Visit the official GitHub repo releases for "nvm-windows" (search "nvm-windows releases").
- Download the latest `nvm-setup.exe` and run it.
- Accept defaults in the installer.

3) Install Node 20 and use it
- Open a new Command Prompt or PowerShell window (important: new shell picks up nvm path).
- Run:

```
nvm install 20
nvm use 20
```

4) Verify

```
node -v
npm -v
```

Notes:
- If you use `nvm` to install Node, do not also install Node via the official Windows installer — you only need one.
- On some Windows systems you may need to run the shell as Administrator for the installer and initial `nvm` setup.
- If you have multiple Node versions, use `nvm list` to see installed versions and `nvm use <version>` to switch.
