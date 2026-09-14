#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJsonPath = resolve(root, "package.json");
const pythonPath = resolve(root, "sdk/python/pyproject.toml");
const rustPath = resolve(root, "sdk/rust/Cargo.toml");
const checkOnly = process.argv.includes("--check");

const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8"));

function updateVersion(path, pattern, replacement) {
  const current = readFileSync(path, "utf8");
  const match = current.match(pattern);
  if (!match) throw new Error(`Could not find version in ${path}`);

  const next = current.replace(pattern, replacement(version));
  if (checkOnly) {
    if (next !== current) {
      throw new Error(`${path} is not aligned with package.json version ${version}`);
    }
    return;
  }

  if (next !== current) writeFileSync(path, next);
}

updateVersion(
  pythonPath,
  /^version = "[^"]+"$/m,
  (nextVersion) => `version = "${nextVersion}"`
);

updateVersion(
  rustPath,
  /^version = "[^"]+"$/m,
  (nextVersion) => `version = "${nextVersion}"`
);

console.log(`${checkOnly ? "verified" : "synchronised"} SDK versions at ${version}`);
