import fs from "fs";
import path from "path";
import dotenv from "dotenv";

let loaded = false;

function mergeEnvFile(envPath: string, protectedKeys: Set<string>) {
  const parsed = dotenv.parse(fs.readFileSync(envPath));

  for (const [key, value] of Object.entries(parsed)) {
    if (protectedKeys.has(key)) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadAppEnv(mode = process.env.NODE_ENV || "development") {
  if (loaded) {
    return;
  }

  const rootDir = process.cwd();
  const protectedKeys = new Set(Object.keys(process.env));
  const envFiles = [
    ".env",
    `.env.${mode}`,
    `.env.${mode}.local`,
    ".env.local",
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(rootDir, envFile);

    if (!fs.existsSync(envPath)) {
      continue;
    }

    mergeEnvFile(envPath, protectedKeys);
  }

  loaded = true;
}
