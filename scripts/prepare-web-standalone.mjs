#!/usr/bin/env node
/**
 * Next.js standalone output does not include .next/static or public/.
 * Copy them beside server.js (same as docker/web.Dockerfile).
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function prepareWebStandalone(repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const webRoot = path.join(repoRoot, "apps/web");
  const standaloneRoot = path.join(webRoot, ".next/standalone/apps/web");
  const staticSrc = path.join(webRoot, ".next/static");
  const staticDest = path.join(standaloneRoot, ".next/static");
  const publicSrc = path.join(webRoot, "public");
  const publicDest = path.join(standaloneRoot, "public");

  if (!existsSync(path.join(standaloneRoot, "server.js"))) {
    throw new Error("Standalone server not found. Run: npm run build -w @movie-server/web");
  }

  if (!existsSync(staticSrc)) {
    throw new Error("Missing .next/static. Run: npm run build -w @movie-server/web");
  }

  mkdirSync(path.join(standaloneRoot, ".next"), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true, force: true });

  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDest, { recursive: true, force: true });
  }

  console.log("Prepared standalone web assets (.next/static + public)");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    prepareWebStandalone();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
