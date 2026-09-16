#!/usr/bin/env node
/**
 * Dev recovery: create or reset the bootstrap Super Admin from .env.
 *
 * Usage:
 *   npm run bootstrap:admin
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

function loadDotEnv() {
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
const uri = process.env.MONGODB_URI;
const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

if (!uri) {
  console.error("MONGODB_URI is missing in .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("Set BOOTSTRAP_SUPERADMIN_EMAIL and BOOTSTRAP_SUPERADMIN_PASSWORD in .env");
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true },
    role: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
  },
  { collection: "users", timestamps: true },
);

async function main() {
  await mongoose.connect(uri);
  const User = mongoose.models.User || mongoose.model("User", userSchema);
  const passwordHash = await bcrypt.hash(password, rounds);
  const normalized = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalized }).select("+passwordHash");
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = "super_admin";
    existing.emailVerified = true;
    existing.isActive = true;
    existing.failedLoginAttempts = 0;
    existing.lockUntil = undefined;
    existing.displayName = existing.displayName || "Super Admin";
    await existing.save();
    console.log(`Reset Super Admin password for ${normalized}`);
  } else {
    await User.create({
      email: normalized,
      passwordHash,
      displayName: "Super Admin",
      role: "super_admin",
      emailVerified: true,
      isActive: true,
      tokenVersion: 0,
    });
    console.log(`Created Super Admin ${normalized}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
