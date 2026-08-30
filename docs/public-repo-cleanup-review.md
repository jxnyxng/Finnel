# Public Repository Cleanup Review

This document lists files that are not needed in the public project output and are candidates for removal from all branch history.

## Recommended History Removal Targets

These paths can be removed from every branch/ref when rewriting history.

```text
CODEX.md
backend/src/main/resources/application-local.yml
REFACTORING_PLAN.md
backend/bin
```

## Rationale

| Path | Current state | History state | Reason |
| --- | --- | --- | --- |
| `CODEX.md` | Tracked on `main` before cleanup | Added in `7861aa7`, modified in several later commits | Local Codex/project operation notes. Not required for build, runtime, or public documentation. It has contained production-operation notes, so public history removal is reasonable. |
| `backend/src/main/resources/application-local.yml` | Tracked on `main` before cleanup | Added in `7fe73b7` | Local Spring profile used to disable sync locally. Not required for public source and should stay local. |
| `REFACTORING_PLAN.md` | Not present on `main` now | Added in `7274c0e`, removed in `21d368e` | Temporary work plan. Not needed in public project history. |
| `backend/bin` | Not present on `main` now | Added in `9328915`, removed in `e7d827d` | Build output copied from compiled resources/classes. Public source should keep `backend/src/...`, not generated `bin` output. |

## Already Checked

- Actual `.env`, `backend/.env`, and `frontend/.env` files were not found in all-ref path history.
- Clear secret formats such as AWS access keys, GitHub tokens, and private-key headers were not found in all-ref grep checks.
- `.env.example` files are intentionally kept because they contain placeholders and document required environment variables.
- `backend/gradle/wrapper/gradle-wrapper.jar` is intentionally kept because it is required for the Gradle wrapper.
- `frontend/package-lock.json` is intentionally kept because it is a dependency lockfile, not a build artifact.

## Current Non-History Cleanup

The working tree cleanup keeps local files on disk but removes these paths from Git tracking on the current branch:

```bash
git rm --cached CODEX.md backend/src/main/resources/application-local.yml
```

Ignore rules were also added for local agent files, local Spring profiles, environment files, IDE files, and build outputs.

## If Approved

Preferred tool:

```bash
git filter-repo --force --invert-paths --paths-from-file docs/public-history-remove-paths.txt
```

Fallback if `git-filter-repo` is unavailable:

```bash
git filter-branch --force --index-filter 'git rm -r --cached --ignore-unmatch CODEX.md backend/src/main/resources/application-local.yml REFACTORING_PLAN.md backend/bin' --prune-empty --tag-name-filter cat -- --all
```

After either rewrite, every affected branch/tag that should remain on GitHub must be force-pushed intentionally.
