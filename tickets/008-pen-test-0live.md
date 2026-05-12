# 008 — Pen-test-0live (pre-live hardening)

## Goal

Harden the Verbmaster Redux Express + static frontend for an Internet-adjacent deployment without introducing auth (app remains read-only public learning content).

## Scope

- Express: consistent validation on query parameters that feed dynamic `IN (...)` clauses and numeric IDs.
- Express: baseline security headers on all responses.
- Frontend: escape or neutralize API-sourced strings inserted into `innerHTML` on high-traffic drill UIs.
- Docker: run the Node process as an unprivileged user.

## Out of scope

- Full Content-Security-Policy blocking inline scripts (would require a larger frontend refactor).
- Rate limiting / WAF (document as operational follow-up).

## Acceptance Criteria

- Requests with empty `tenses` or empty `verbs` lists after parsing return `400` instead of generating invalid SQL.
- Invalid non-numeric `verb_id` returns `400`.
- Responses include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.
- Conjugation game and shared flashcard UI escape HTML when interpolating database-backed strings.
- Container image runs as non-root.

## Dependencies

- Existing Express API in `server.js`
- Static assets under `public/`
