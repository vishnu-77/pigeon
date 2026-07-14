// Extracts the CHANGELOG.md section body for a given version, for use as GitHub
// Release notes. Prints the section under `## [<version>]` (without the heading), or a
// one-line fallback if the version has no section yet.
//
// Run:  node scripts/changelog-section.mjs 0.2.0

import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").trim();
if (!version) {
  console.log("Release.");
  process.exit(0);
}

let text = "";
try {
  text = readFileSync("CHANGELOG.md", "utf8");
} catch {
  console.log(`Release v${version}.`);
  process.exit(0);
}

const lines = text.split("\n");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^##\\s*\\[${escaped}\\]`);
const anyHeading = /^##\s*\[/;

const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.log(`Release v${version}.`);
  process.exit(0);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i += 1) {
  if (anyHeading.test(lines[i])) {
    end = i;
    break;
  }
}

const body = lines
  .slice(start + 1, end)
  // Drop trailing markdown link-reference definitions (e.g. "[0.1.0]: https://...")
  // which belong to the whole file, not this section.
  .filter((line) => !/^\[[^\]]+\]:\s+\S/.test(line))
  .join("\n")
  .trim();
console.log(body || `Release v${version}.`);
