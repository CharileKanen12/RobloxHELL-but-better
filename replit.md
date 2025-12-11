# robloxHELL CLI

## Overview
This is a command-line tool that scrapes Roblox friends lists and group rosters, checks users against the Rotector API, and generates JSON reports.

## Tech Stack
- **Runtime**: Bun (v1.2+)
- **Language**: TypeScript
- **Dependencies**: @types/bun, typescript

## Project Structure
```
src/
├── index.ts         # Main CLI entry point with argument parsing
├── rotector.ts      # Rotector API client for user safety checks
├── usersScraper.ts  # Scrapes Roblox friends lists
└── groupsScraper.ts # Scrapes Roblox group members
```

## Running the CLI

### Prerequisites
Set the `COOKIE` environment variable to a valid `.ROBLOSECURITY` token from Roblox.

### Commands
```bash
# Show help
bun run src/index.ts --help

# Scrape friends
bun run src/index.ts --output ./reports --friend <userId>

# Scrape group
bun run src/index.ts --output ./reports --group <groupId>:<cap>

# Exclude specific users from Rotector checks
bun run src/index.ts --output ./reports --group <groupId> --exclude <userId1>,<userId2>
```

### CLI Options
| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Required. Directory for JSON reports |
| `-f, --friend <id>` | Roblox user ID(s) to scrape friends |
| `-g, --group <id[:cap]>` | Roblox group ID with optional member cap |
| `-x, --exclude <id[,id]>` | User ID(s) to exclude from Rotector checks |
| `-v, --verbose` | Show detailed progress logs |
| `-h, --help` | Display help |

## Output Structure
Reports are saved to `<output>/<runId>/` with:
- `index.json` - Run metadata and statistics
- `users` or role files - Collected user IDs
- `rotector` - NDJSON with Rotector check results
- `summary.json` - Aggregated run statistics

## Unsafe Users Tracking
After each scan, unsafe users are automatically saved to `<output>/unsafe_users.txt` with format:
```
<roblox_id> - <discord_id>
```
If no Discord ID is found in the Rotector data, "unknown" is used. This file persists across scans and accumulates all unique unsafe users.
