# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install          # Install dependencies
node ./cli.js <cmd>  # Run the CLI in development mode
npm test             # Run all linters (editorconfig + eslint + prettier)
npm run lint:eslint  # ESLint only
npm run lint:prettier # Prettier check only
```

Prettier formatting (auto-fix):
```sh
prettier --single-quote --trailing-comma=es5 --print-width=120 --write src/*/*.js
```

## Architecture

This is an ESM (`"type": "module"`) Node.js CLI using `commander` for argument parsing. The entry point is `cli.js`, which registers three commands and delegates to command classes.

**Layer structure:**

- `cli.js` — Entry point; wires commander commands to command classes
- `src/commands/` — One class per CLI command (`download.js`, `query.js`, `login.js`). Each command instantiates services/modules and connects to Soulseek.
- `src/services/` — Stateful services passed between layers:
  - `CredentialsService` — Reads credentials from env vars (`SOULSEEK_ACCOUNT`, `SOULSEEK_PASSWORD`) or OS keychain via `keytar`; connects to the `slsk-client`
  - `SearchService` — Manages a queue of search queries, consumed one at a time
  - `DownloadService` — Manages download state and logging
- `src/modules/` — Core logic units:
  - `Search` — Executes the search loop; on results, presents an `inquirer` prompt for user selection
  - `FilterResult` — Filters search results by free slots, file type (mp3/flac), and bitrate; groups by user+folder
  - `Download` — Handles file download initiation
  - `DownloadLogger` — Tracks and logs download progress
  - `DestinationDirectory` — Resolves the download destination path

**Data flow for `download` command:**
`CredentialsService.connect()` → `slsk-client` connection → `Search.search()` → `FilterResult.filter()` → inquirer prompt → `Download.startDownloads()`

**Credentials:** Stored under keychain service name `soulseek-cli`. Env vars take priority over keychain.
