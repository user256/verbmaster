# Verbmaster Redux — ticket overview

This folder tracks work as numbered markdown tickets. See `QUEUE.md` for ordered status.

## Completed lanes

- **Mini-lesson pack**: `001`–`007` — structure, ingestion, verb/phrase/sentence stages, entry wiring, QA.

## Active sprint: pen-test-0live

**Goal**: Reduce exploitable surface before the app is reachable on a host-facing port (see `docker-compose.yml` mapping `3001:3000`).

**Ticket**: [`008-pen-test-0live.md`](008-pen-test-0live.md)

**Themes**:

1. HTTP API robustness (reject malformed query combinations that break SQL or confuse caches).
2. Baseline security headers on the Express static/API server.
3. Defense-in-depth for DOM XSS where lesson/API strings are injected via `innerHTML`.
4. Container posture (non-root runtime user).

## How to use tickets

- Each `00x-*.md` file lists goal, scope, acceptance criteria, and dependencies.
- Move items in `QUEUE.md` from `todo` → `in_progress` → `done` as work lands.
