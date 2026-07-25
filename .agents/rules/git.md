# Git Rules

## Branch Strategy

- `develop` — all active development happens here
- `main` — stable, store-ready releases only
- Never push directly to `main` or `develop` — always go through a PR
- Feature branches: `feat/short-description`
- Bug fix branches: `fix/short-description`

## Implementing a Plan — Mandatory Workflow

Before writing any code from an agreed plan:

1. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feat/short-description
   ```
2. **Implement** on that branch
3. **Raise a PR** targeting `develop` — never `main`
4. **Do not merge** — leave the PR for the human to review and approve

Never implement directly on `develop` or `main`.

---

## Commit Message Format

Follow **Conventional Commits**. Every commit must match:

```
<type>: <message>
```

### Allowed Types

| Type | When to use |
|---|---|
| `feat` | New feature or user-visible addition |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `style` | Formatting, CSS, visual tweaks |
| `chore` | Build scripts, config, tooling |
| `docs` | Documentation only |
| `test` | Tests only |
| `ci` | CI/CD workflow changes |
| `build` | Build system or dependency changes |
| `perf` | Performance improvement |
| `revert` | Reverts a previous commit |

### Examples

```
feat: add speed control slider to pill player
fix: prevent pill from restarting on voice change
refactor: move popup files into popup/ subfolder
style: update pill dark theme border color
chore: update build script for new src structure
```

### Rules

- Subject line: lowercase, no period at end
- Max 72 characters total
- Use imperative mood ("add", "fix", "move" — not "added", "fixes", "moved")
- One logical change per commit — keep commits focused

> These are conventions, not enforced checks. CI lints the **PR title** only — the commitlint job was removed, so individual commit messages are no longer validated. `commitlint.config.js` remains in the repo but nothing reads it.

---

## Pull Requests

- Always target `develop`, never `main`
- PR title must follow the same `<type>: <message>` format as commits
- Keep the PR description concise — what changed and why
- Do not merge — leave for human review

---

## What Agents Must Never Do

- Never force-push to `main` or `develop`
- Never use `--no-verify` to skip hooks
- Never amend a commit that has already been pushed
- Never commit directly to `main` or `develop`
