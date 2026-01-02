@echo off

echo Starting FastAPI server...
cd ..\backend
call .venv\Scripts\activate.bat

start /B fastapi dev controller.py
set SERVER_PID=%ERRORLEVEL%

echo Waiting for server to start...
:wait_loop
curl -s http://localhost:8000/openapi.json >nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo Server is ready, generating API client...
cd ..\frontend
call openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o ./src/api-client

echo API client generated successfully!

echo Stopping FastAPI server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq*fastapi*" >nul 2>&1

echo Done!
pause