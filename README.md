# robloxHELL CLI

This project scrapes Roblox friends lists and/or group rosters, checks every user against the Rotector API, and writes JSON reports to a directory that you control.

## Install

```bash
bun install
```

## Usage

Set the `COOKIE` environment variable to a valid `.ROBLOSECURITY` token before running the CLI.

```bash
COOKIE="<your .ROBLOSECURITY token>" bun run src/index.ts --output ./reports --friend 7345807477 --group 4553650:30000
```

Options:

| Flag | Description |
| ---- | ----------- |
| `-o`, `--output <dir>` | **Required.** Directory where per-source and summary JSON reports are written (created if missing). |
| `-f`, `--friend <id[,id]>` | Roblox user ID(s) whose entire friend list will be scraped. Repeat the flag or pass a comma-separated list for multiple users. |
| `-g`, `--group <id[:cap]>` | Roblox group ID to scrape. Optionally append `:<memberCount>` to stop after a specific number of members. Repeat for multiple groups. |
| `-v`, `--verbose` | Show detailed logs instead of the default single-line status display. |
| `-h`, `--help` | Display CLI help. |

Without `--verbose` the CLI keeps the console to a single status line per target, updating it live as IDs stream in and Rotector batches finish. Use `--verbose` if you need to inspect every internal step.

Every run creates a timestamped directory at `<output>/<runId>/`. Inside it you will find one folder per target (`friends-<userId>` or `group-<groupId>`) with the following contents:

| File | Description |
| ---- | ----------- |
| `index.json` | Snapshot of run metadata, counts, and flag breakdown for that target. |
| `users` (friends only) | Plaintext log of every collected user ID in order, appended live while scraping. |
| `rotector` | NDJSON stream — each line is a single JSON object with Rotector results for one Roblox user, written live as batches complete. |
| `roles.json` (groups only) | List of roles for the group, including IDs, ranks, and names. |
| `<roleId>` (groups only) | Plaintext log for that role; each member ID is appended live as it is discovered. |

Rotector is called every 50 newly collected IDs (or the last remainder) so output files update in near real time. After all targets finish, `<output>/<runId>/summary.json` aggregates run-level statistics.

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
