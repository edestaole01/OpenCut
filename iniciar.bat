@echo off
title VideoAI - Servidor Local
color 0A

echo ====================================
echo   VideoAI - Iniciando servidor...
echo ====================================
echo.

cd /d D:\LPP\OpenCut\apps\web

REM Libera porta 3000 se estiver ocupada
echo Liberando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo Iniciando servidor Next.js...
echo.
echo Acesse: http://localhost:3000/login
echo.
echo Para parar: feche esta janela ou pressione Ctrl+C
echo.

D:\bun\bun-windows-x64\bun.exe run dev
