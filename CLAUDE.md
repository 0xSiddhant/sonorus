# Sonorus — Claude Instructions

## Agent Rules & Memory

All rules, memory, and context for this project live in `.agents/`:

- `.agents/rules/git.md` — branch strategy, commit format, PR conventions
- `.agents/memory/` — persistent project memory and notes
- `.agents/context/` — background context about the project

**Read these files at the start of every session before taking any action.**

## Key Rules (summary)

- All PRs must target `develop`, never `main`
- Never push directly to `main` or `develop`
- Follow Conventional Commits for all commit messages
- Do not merge PRs — leave for human review
