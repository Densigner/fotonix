# Server Restart Instructions

The store name availability check endpoint has been added but requires a server restart.

## Quick Restart Steps:

### Option 1: Kill all Node processes and restart
```powershell
# Stop all Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Navigate to server directory
cd server

# Start the server
node index.js
```

### Option 2: If using nodemon
```powershell
# Just save the member.js file again, or
# Restart nodemon manually:
cd server
npx nodemon index.js
```

### Option 3: If running from root
```powershell
# Stop all Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start server from root
npm run server
# OR
node server/index.js
```

## Verify the endpoint works:
After restarting, test the endpoint in your browser or with PowerShell:

```powershell
# Test endpoint
curl http://localhost:4000/api/member/check-store-name?storeName=teststore
```

You should see JSON response like:
```json
{"available": true, "storeName": "teststore"}
```

## What was added:
- **Backend**: New GET endpoint `/api/member/check-store-name` in `server/routes/member/member.js`
- **Frontend**: Debounced availability checking in `Signup.js` with visual feedback
- **Database**: Checks `business_emails` table for existing store names (case-insensitive pattern matching)
