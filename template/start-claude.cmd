@echo off
rem Claude Code in this repository, with the product's app repositories beside
rem it added (scripts\start-claude.mjs). Arguments go on to claude.
cd /d "%~dp0"
node scripts\start-claude.mjs %*
