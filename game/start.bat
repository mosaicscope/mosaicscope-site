@echo off
rem Start the Mosaics' world locally. Needs Node.js (https://nodejs.org).
cd /d "%~dp0"
where npm >nul 2>nul || (echo Please install Node.js from https://nodejs.org first. & pause & exit /b 1)
if not exist node_modules call npm install
call npm start
