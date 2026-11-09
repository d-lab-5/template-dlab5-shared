@echo off
rem Claude Code in this repository, with the product's app repositories beside
rem it added (scripts\start-claude.py). Arguments go on to claude.
rem Python, not Node: every computer that runs an edge has it.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\start-claude.py %*
) else (
  python scripts\start-claude.py %*
)
exit /b %errorlevel%
