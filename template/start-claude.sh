#!/usr/bin/env bash
# Claude Code in this repository, with the product's app repositories beside
# it added (scripts/start-claude.mjs). Arguments go on to claude.
cd "$(dirname "$0")" && exec node scripts/start-claude.mjs "$@"
