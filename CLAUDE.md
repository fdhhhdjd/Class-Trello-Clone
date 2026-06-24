# CLAUDE.md

Project guidance for Claude Code.

## Project

Trello clone.

## Imports

@.claude/skills/token.md
@.claude/skills/deploy-workflow.md
@.claude/skills/source-code.md
@.claude/skills/multi-agent.md

## References

- [Trello_Modules_Plan.md](.claude/references/Trello_Modules_Plan.md) — module & feature plan (18 modules), MVP flow, 70% core-value scope.
- [trello.com-DESIGN.md](.claude/references/trello.com-DESIGN.md) — design system: color palette, typography, components, layout, responsive. Follow when building any UI.

## Commands

- `/build` — guide a feature/product from idea → PRD → technical plan → build guide → handoff. See [.claude/commands/build.md](.claude/commands/build.md).
- `/project-manager` — senior PM agent: plan sprints, define requirements, manage scope/delivery. See [.claude/commands/project-manager.md](.claude/commands/project-manager.md).
- `/ssh-vps` — use when setting up SSH + GitHub + VPS deploy (DEV/PROD), or any SSH key / VPS deploy config task. See [.claude/commands/ssh-vps.md](.claude/commands/ssh-vps.md).
- `/harden` — VPS hardening checklist: 6 rules (SSH key, firewall + ufw-docker, fail2ban, non-root app, reverse proxy, docker group). Each item CHECK + FIX + VERIFY. See [.claude/commands/harden.md](.claude/commands/harden.md).
- `/BACKUP-GDRIVE-SETUP` — step-by-step admin guide to set up Google Drive backup via rclone OAuth (GCP project → Drive API → OAuth → `/admin/backup`). See [.claude/commands/BACKUP-GDRIVE-SETUP.md](.claude/commands/BACKUP-GDRIVE-SETUP.md).
- `/BACKUP-FEATURE-BLUEPRINT` — portable reference to add a backup feature to any web app (admin `/admin/backup`, 4 tabs, rclone → Drive/S3, scheduled cron). See [.claude/commands/BACKUP-FEATURE-BLUEPRINT.md](.claude/commands/BACKUP-FEATURE-BLUEPRINT.md).
- `/monitoring` — concrete Prometheus + Grafana + Node Exporter monitoring setup on VPS (single-VPS or dev-queries-prod via Nginx auth proxy). See [.claude/commands/monitoring.md](.claude/commands/monitoring.md).
- `/observability` — stack-agnostic observability standard: 3 pillars (metrics/logs/traces), RED/USE, SLI/SLO/error-budget, burn-rate alerts. Design layer that maps down to `/monitoring`. See [.claude/commands/observability.md](.claude/commands/observability.md).
