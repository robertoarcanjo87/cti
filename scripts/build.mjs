import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = process.env.VERCEL
  ? "./build-vercel-redirect.mjs"
  : "./run-framework.mjs";
const args = process.env.VERCEL ? [] : ["build"];

const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL(script, import.meta.url)), ...args],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
