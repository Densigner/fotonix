@echo off
REM Wrapper to start openaiImageProxy with env vars and log to openai.log
cd /d "%~dp0"
set SKIP_OPENAI=1
set PORT=5002
node openaiImageProxy.js > openai.log 2>&1
pause
