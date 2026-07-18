# MyOwnClaudeSkills

Personal Claude Code skills. Each skill lives in `skills/<name>/` and is installed by
copying that folder into `~/.claude/skills/`.

## Skills

| Skill | What it does |
|---|---|
| [`perfectionistDesign`](skills/perfectionistDesign/SKILL.md) | End-to-end pipeline for building a premium marketing site: discovery interview → ChatGPT mockup → spec extraction → image generation → self-contained build → measurement-based verification → deploy + git. |

## Install

```powershell
.\sync-to-claude.ps1
```

Copies every skill in `skills/` into `%USERPROFILE%\.claude\skills\`. Re-run after editing.
Use `-WhatIf` to preview.

Skills are read at session start, so restart Claude Code (or start a new session) after
syncing.

## Layout

```
skills/<name>/
├── SKILL.md          # frontmatter (name, description) + the orchestration
├── references/       # loaded on demand, one file per phase
└── templates/        # files the skill copies into a project
```

`SKILL.md` stays short and delegates. Detail belongs in `references/` so it is pulled in
only when that phase is actually running.

The `description` in the frontmatter is what triggers auto-invocation — write it as the
situations the skill applies to, not as a summary of its contents.
