@echo off
title Concord - Publicar nova versao do app desktop
cd /d "%~dp0"

echo ======================================================
echo    PUBLICAR NOVA VERSAO DO CONCORD PARA PC
echo ======================================================
echo.
echo Antes de continuar, aumente "version" em desktop\package.json
echo (ex.: 1.1.0 para 1.1.1). Os apps instalados vao se
echo atualizar sozinhos com a versao publicada.
echo.
pause

call npm.cmd --prefix desktop run release

echo.
pause
