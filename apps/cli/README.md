# Agent Passport

**Your coding agent did the work. Your personal assistant picks it up.**

```sh
npx agent-passport
```

The dashboard opens in your browser and lists projects you worked on with Claude Code or Codex.

1. Click **Hand off**. That agent writes a Handoff from a copy of your latest session: the goal,
   what's done, the decisions and why, blockers, and next steps. It gets no tools, so nothing in
   your project changes.
2. Review exactly what will be shared, then approve it.
3. Give your assistant the private Connection link. Muse is the first supported assistant:
   [Connect Muse](https://github.com/AbdulsaboorS/agent-passport/blob/main/docs/connect-muse.md).
4. Send newer Handoffs through the same link, or revoke access in one click.

Passwords, tokens, and keys never travel. Handoffs name the tools a project needs, and your
assistant asks you to sign in to each one on its side. Drafts containing anything that looks like a
credential are refused.

**Requirements:** macOS, Node.js 24+, and Claude Code or Codex used on a GitHub repository.

## Commands

| Command | What it does |
|---|---|
| `agent-passport` | Opens the dashboard |
| `agent-passport serve` | Starts the dashboard without opening a browser |
| `agent-passport skill` | Prints instructions any coding agent can follow to write a Handoff |
| `agent-passport draft --schema` | Prints the Handoff format an agent writes |
| `agent-passport draft --repo <path>` | Saves a Handoff an agent wrote (JSON on stdin) as a draft |

Source, security model, and issues: https://github.com/AbdulsaboorS/agent-passport

Licensed under Apache-2.0.
