#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targets = [
  ".next/trace",
  ".next-build/trace",
  ".next-dev/trace",
  ".next/cache",
  ".next-build/cache",
  ".next-dev/cache",
];

async function safeRemove(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`[clean-next-artifacts] removed ${relativePath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[clean-next-artifacts] skip ${relativePath}: ${message}`);
  }
}

for (const target of targets) {
  await safeRemove(target);
}

console.log("[clean-next-artifacts] done");
