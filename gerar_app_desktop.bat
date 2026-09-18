@echo off
title Concord - Gerador de Instalador Profissional (.exe)
cd /d "%~dp0"

echo ======================================================
echo    GERANDO INSTALADOR PROFISSIONAL CONCORD-SETUP.EXE
echo ======================================================
echo.
echo 1. Construindo interface atualizada (Vite)...
call npm.cmd --prefix client run build

echo.
echo 2. Sincronizando arquivos de UI para o aplicativo desktop...
if not exist "desktop\ui" mkdir "desktop\ui"
xcopy /E /I /Y "client\dist\*" "desktop\ui\" >nul

echo.
echo 3. Compilando binarios do Electron...
call npm.cmd --prefix desktop run build:pack

echo.
echo 4. Gerando instalador profissional Concord-Setup.exe com Inno Setup...
call npm.cmd --prefix desktop run build:installer

echo.
echo ======================================================
echo    INSTALADOR GERADO COM SUCESSO!
echo.
echo    Arquivo Instalador:
echo    desktop\dist-installer\Concord-Setup.exe
echo.
echo    Este e o arquivo que voce pode enviar para seus amigos!
echo ======================================================
echo.
pause
