---
description: Compute Pigeon's next SemVer version from Conventional Commits and offer to apply it
---

Compute the next release version for this repo and help the user apply it.

## Steps

1. Run the compute script and read its JSON output:

   ```bash
   npm run version:next -- --json
   ```

   The JSON has: `current`, `next`, `bump` (`major`/`minor`/`patch`/`none`), `lastTag`,
   `commitsConsidered`, `conventionalCommits`, `nonConventionalCommits`, and a `note`.

2. Show the user a one-line summary: `current -> next (bump)`, plus the `note` if present
   (e.g. "no conventional commits found - defaulting to a patch bump", or the pre-1.0
   guard). If `bump` is `none`, tell them there is nothing to release and stop.

3. If `$ARGUMENTS` is empty, ask whether to apply the computed bump. If `$ARGUMENTS`
   contains `apply`, proceed to apply without asking.

4. When applying:
   - Move the entries under `## [Unreleased]` in `CHANGELOG.md` into a new
     `## [<next>] - <YYYY-MM-DD>` section, and refresh the compare links at the bottom
     of the file. Ask the user for today's date (do not invent one).
   - Do NOT run `npm version` or push yourself. Print the exact commands for the user to
     run, since tagging triggers the release workflow:

     ```bash
     npm version <bump>        # e.g. npm version minor  -> bumps package.json + tags
     git push --follow-tags    # triggers .github/workflows/release.yml
     ```

5. Remind the user to also check whether this release warrants an ADR
   (`docs/adr/`) or a `docs/progress.md` update.

Never create or push a git tag on the user's behalf - only propose the commands.
