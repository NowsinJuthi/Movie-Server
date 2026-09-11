import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nestCli = path.join(root, "node_modules", "@nestjs", "cli", "bin", "nest.js");
const args = process.argv.slice(2);
const nodeOptions = [process.env.NODE_OPTIONS, "--openssl-legacy-provider"]
  .filter(Boolean)
  .join(" ")
  .trim();

const child = spawn(process.execPath, [nestCli, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
