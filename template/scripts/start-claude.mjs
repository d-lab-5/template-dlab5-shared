#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 D-LAB-5
/**
 * Start Claude Code in this repository with the product's application
 * repositories added (shared.json's app_repos), found beside this one:
 *
 *   ../<this>-shared   here: the docs, and the session's settings and memory
 *   ../<app repo>      each added with --add-dir when it is there
 *
 * Run it through start-claude.sh (Linux, macOS) or start-claude.cmd
 * (Windows). Anything after the command goes to claude as it is, e.g.
 * `./start-claude.sh --continue`. `--print-command` only shows what would run.
 *
 * A repository that is not beside this one is named with the command that
 * clones it, and left out: the session starts anyway.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { config, REPO } from "./config.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--print-command");
const passOn = args.filter((a) => a !== "--print-command");

const parent = resolve(REPO, "..");
const dirs = [];
for (const { repo } of config().app_repos || []) {
  const name = String(repo).split("/").pop();
  const dir = join(parent, name);
  if (existsSync(join(dir, ".git"))) dirs.push(dir);
  else console.error(`not beside ${basename(REPO)}: ${repo}  (gh repo clone ${repo} ${dir})`);
}

const command = ["claude", ...dirs.flatMap((d) => ["--add-dir", d]), ...passOn];
const win = process.platform === "win32";
const quote = (a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);
if (dry) {
  console.log(command.map(quote).join(" "));
  process.exit(0);
}
// on Windows `claude` may be a .cmd shim, which only a shell can start
const child = win
  ? spawn(command.map(quote).join(" "), { cwd: REPO, stdio: "inherit", shell: true })
  : spawn(command[0], command.slice(1), { cwd: REPO, stdio: "inherit" });
child.on("error", (e) => {
  console.error(e.code === "ENOENT" ? "Claude Code (`claude`) is not installed or not on PATH" : e.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
