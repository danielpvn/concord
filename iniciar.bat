@echo off
title Concord - Hub Gamer dos Amigos
cd /d "%~dp0"

echo ======================================================
echo    INICIANDO CONCORD - HUB GAMER PRIVADO DOS AMIGOS
echo ======================================================
echo.
echo Abrindo o Concord no navegador em instantes...
echo.

start "" "http://localhost:5173"
npm start
