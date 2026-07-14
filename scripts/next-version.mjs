// Computes the next SemVer version for Pigeon from Conventional Commits since the
// last release tag, so bumping is derived from history instead of guessed.
//
// Rules (https://www.conventionalcommits.org):
//   - a commit with `!` after the type/scope, or a `BREAKING CHANGE:` footer -> major
//   - `feat:`                                                                -> minor
//   - `fix:` / `perf:`                                                       -> patch
//   - other conventional types (docs, chore, refactor, ...)                  -> patch
//   - non-conventional commits are counted but do not, alone, force a bump
// The highest level among the commits wins. While the package is pre-1.0 (major 0),
// a would-be `major` is softened to `minor` per the SemVer "initial development" rule.
//
// No release tags yet? The current package.json version is treated as the base and
// every commit reachable from HEAD is considered.
//
// Zero runtime dependencies - Node standard library only.
//
// Run:  npm run version:next          (human summary + JSON)
//       npm run version:next -- --json (JSON only, for tooling)

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const jsonOnly = process.argv.includes("--json");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// --- current version ----------------------------------------------------
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const current = pkg.version;
const [curMajor, curMinor, curPatch] = current.split(".").map(Number);

// --- last tag + commit range -------------------------------------------
const lastTag = git("describe --tags --abbrev=0");
const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

// Split commits on a NUL delimiter so multi-line bodies stay intact.
const raw = git(`log ${range} --format=%B%x00`);
const commits = raw
  .split("\0")
  .map((c) => c.trim())
  .filter(Boolean);

// --- classify -----------------------------------------------------------
const TYPE_LEVEL = { feat: "minor", fix: "patch", perf: "patch" };
const HEADER = /^(\w+)(\([^)]*\))?(!)?:\s/;
const RANK = { patch: 1, minor: 2, major: 3 };

let level = null; // null == no releasable change found
const contributors = [];
let nonConventional = 0;

for (const commit of commits) {
  const subject = commit.split("\n", 1)[0];
  const match = subject.match(HEADER);
  if (!match) {
    nonConventional++;
    continue;
  }
  const [, type, , bang] = match;
  const breaking = Boolean(bang) || /^BREAKING[ -]CHANGE:/m.test(commit);
  const commitLevel = breaking ? "major" : TYPE_LEVEL[type] || "patch";
  contributors.push({ subject, type, level: commitLevel });
  if (!level || RANK[commitLevel] > RANK[level]) level = commitLevel;
}

// --- decide the bump ----------------------------------------------------
let bump = level;
let note = "";

if (!bump) {
  // No conventional commits. If there is any history at all, a patch keeps things
  // moving; otherwise there is nothing to release.
  if (commits.length) {
    bump = "patch";
    note = "no conventional commits found - defaulting to a patch bump";
  } else {
    note = "no commits since the last tag - nothing to release";
  }
}

// SemVer initial-development guard: pre-1.0 breaking changes bump the minor, not the
// major, so the package does not jump to 1.0.0 unintentionally.
if (bump === "major" && curMajor === 0) {
  bump = "minor";
  note = "pre-1.0: a breaking change bumps the minor (not 1.0.0) - promote to 1.0.0 by hand when ready";
}

function applyBump(kind) {
  switch (kind) {
    case "major":
      return `${curMajor + 1}.0.0`;
    case "minor":
      return `${curMajor}.${curMinor + 1}.0`;
    case "patch":
      return `${curMajor}.${curMinor}.${curPatch + 1}`;
    default:
      return current;
  }
}

const next = bump ? applyBump(bump) : current;

const result = {
  current,
  next,
  bump: bump || "none",
  lastTag: lastTag || null,
  commitsConsidered: commits.length,
  conventionalCommits: contributors.length,
  nonConventionalCommits: nonConventional,
  note: note || null,
};

// --- output -------------------------------------------------------------
if (jsonOnly) {
  console.log(JSON.stringify(result));
} else {
  const base = lastTag ? `since ${lastTag}` : "no tags yet - using package.json as base";
  console.log(`Pigeon version check (${base})`);
  console.log("");
  console.log(`  current : ${current}`);
  console.log(`  bump    : ${result.bump}`);
  console.log(`  next    : ${next}`);
  if (note) console.log(`  note    : ${note}`);
  console.log("");
  console.log(
    `  ${commits.length} commit(s) considered - ${contributors.length} conventional, ${nonConventional} not.`
  );
  if (contributors.length) {
    console.log("  Contributing commits:");
    for (const c of contributors) {
      console.log(`    ${c.level.padEnd(5)}  ${c.subject}`);
    }
  }
  console.log("");
  console.log(`  ${JSON.stringify(result)}`);
}
