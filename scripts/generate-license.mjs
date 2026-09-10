#!/usr/bin/env node
/**
 * Vendor tool: generate a signed CineVault license key.
 *
 * Usage:
 *   node scripts/generate-license.mjs
 *   node scripts/generate-license.mjs --days 365 --edition pro
 *   LICENSE_MASTER_SECRET=... node scripts/generate-license.mjs --lifetime
 *
 * The secret MUST match the API's LICENSE_MASTER_SECRET (or JWT_ACCESS_SECRET fallback).
 */
import { createHmac, randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadDotEnv() {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    break;
  }
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseArgs(argv) {
  const out = { days: null, edition: 'pro', lifetime: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--lifetime') out.lifetime = true;
    else if (arg === '--days') out.days = Number(argv[++i]);
    else if (arg === '--edition') out.edition = String(argv[++i] || 'pro');
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

loadDotEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage: node scripts/generate-license.mjs [--days N] [--lifetime] [--edition standard|pro]`);
  process.exit(0);
}

const secret =
  process.env.LICENSE_MASTER_SECRET?.trim() || process.env.JWT_ACCESS_SECRET?.trim() || '';
if (!secret || secret.length < 32) {
  console.error('Set LICENSE_MASTER_SECRET (preferred) or JWT_ACCESS_SECRET (32+ chars).');
  process.exit(1);
}

if (args.edition !== 'standard' && args.edition !== 'pro') {
  console.error('edition must be standard or pro');
  process.exit(1);
}

let exp = null;
if (!args.lifetime) {
  const days = Number.isFinite(args.days) && args.days > 0 ? args.days : 365;
  exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

const payload = {
  v: 1,
  edition: args.edition,
  exp,
  jti: randomBytes(8).toString('hex'),
};
const PREFIX = 'CV1';
const body = b64url(JSON.stringify(payload));
const sig = b64url(createHmac('sha256', secret).update(`${PREFIX}.${body}`, 'utf8').digest());
const key = `${PREFIX}.${body}.${sig}`;

console.log(JSON.stringify({ licenseKey: key, payload }, null, 2));
