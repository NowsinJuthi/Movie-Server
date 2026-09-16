#!/usr/bin/env node
/**
 * Production Next.js (standalone) — port 3000 (same as dev; nginx → movies.amarpin.com).
 */
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { prepareWebStandalone } from "./prepare-web-standalone.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(repoRoot, "apps/web/.next/standalone/apps/web/server.js"),
  path.join(repoRoot, "apps/web/.next/standalone/server.js"),
];
const serverEntry = candidates.find((entry) => existsSync(entry));

if (!serverEntry) {
  console.error(
    "Web standalone build not found. Run: npm run build -w @movie-server/web",
  );
  process.exit(1);
}

prepareWebStandalone();

const port = process.env.PORT ?? "3000";
const hostname = process.env.HOSTNAME ?? "127.0.0.1";

const child = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry),
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
