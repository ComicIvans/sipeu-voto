# Claude Code — Votaciones SIPEU

Read and follow [AGENTS.md](./AGENTS.md); it is the source of truth for stack, structure, domain rules and conventions.

Quick reminders:

- Spanish for every user-facing string, English for code and comments.
- One-off internal tool for a small group: prefer simple, working solutions over abstractions.
- After changing anything users see, emit the matching SSE event on the server.
- Run `pnpm lint:fix` and `pnpm typecheck` before finishing.
- Commit messages: Conventional Commits, in English.
