# Google Voice CLI

`gvoice` is a local, read-only command-line companion for existing Google Voice
text messages. It opens the Google Voice web app through a dedicated Chrome
profile, so Google handles passwords and 2-step verification directly.

> [!IMPORTANT]
> This is an independent, unofficial project. It is not affiliated with or
> endorsed by Google. Google does not publish an end-user API for Google Voice
> calls, texts, or inbox history, so web-app changes can break this tool.

## What it does

- Signs in through a visible Chrome window.
- Checks whether the saved session is authenticated.
- Lists existing message threads.
- Reads one thread by list index or preview text.
- Shows messages from a recent time window, optionally incoming only.
- Prints human-readable text or machine-readable JSON.

The CLI deliberately has no commands for sending, calling, archiving, deleting,
marking spam, changing settings, or otherwise mutating Google Voice state. Its
browser transport allowlists the Voice endpoints needed to load account and
thread data and blocks unknown or state-changing Voice requests.

## Requirements

- Node.js 20 or newer
- Google Chrome installed locally
- A Google account with Google Voice

## Install from source

```sh
git clone https://github.com/tipu/google-voice-cli.git
cd google-voice-cli
npm install
npm link
```

`npm link` makes the `gvoice` command available in your current Node.js
environment. This repository is not published as an npm package.

## Quick start

```sh
gvoice login
gvoice status
gvoice messages
gvoice read 1
gvoice recent 24h --incoming
```

`gvoice login` opens Chrome for manual sign-in. Complete Google's prompts and
close that Chrome window when finished. Later commands reuse the dedicated local
profile.

## Commands and options

| Command | Options and arguments | Purpose |
| --- | --- | --- |
| `gvoice login` | none | Open Chrome for manual Google sign-in. |
| `gvoice status` | `--json` | Check the saved session and show account status. |
| `gvoice messages` | `-n, --limit <count>` (default `20`, range `1`–`100`); `--json` | List conversation previews. Alias: `threads`. |
| `gvoice recent <duration>` | `--incoming`; `-n, --limit <count>` (default `100`, range `1`–`100`); `--json` | List individual messages in a time window. |
| `gvoice read <thread>` | `-n, --limit <count>` (default `100`, range `1`–`100`); `--json` | Read a thread by its 1-based list index or case-insensitive preview text. |
| `gvoice open` | none | Open the message inbox in the dedicated, read-only browser profile. |
| `gvoice policy` | none | Print the project's API and automation boundary. |

All commands also support `-h, --help`. At the top level, use `-V, --version`
to print the installed version.

Durations accept seconds, minutes, hours, days, or weeks. Examples: `30m`,
`24h`, `72h`, `7d`, and `2w`. The minimum is one second and the maximum is 365
days.

Examples:

```sh
gvoice messages --limit 50
gvoice threads --json
gvoice recent 30m
gvoice recent 7d --incoming --limit 100 --json
gvoice read "Ada" --json
```

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `GVOICE_PROFILE_DIR` | `~/.config/google-voice-cli/chrome` | Chrome profile directory used for the saved Google session. An absolute path is recommended. |
| `GVOICE_CHROME_CHANNEL` | `chrome` | Playwright browser channel to launch. The selected channel must be installed locally. |

For example:

```sh
GVOICE_PROFILE_DIR=/private/path/gvoice-profile gvoice login
GVOICE_CHROME_CHANNEL=chrome-beta gvoice status
```

## Privacy and security

- The Chrome profile contains session cookies and other sensitive account data.
  It stays on your machine by default and must never be committed or shared.
- This repository ignores common local profile names, environment files, keys,
  cookies, and exported authentication-state files as a defense against
  accidental commits.
- The CLI never asks for, reads, or stores your Google password. Authentication
  happens in Google's own browser pages.
- Message output is private data. Be careful with shell history, terminal logs,
  screenshots, redirection, and especially `--json` output files.
- Read commands depend on unsupported Google Voice web behavior. Treat this as a
  personal convenience tool, review the code before use, and follow Google's
  applicable terms and policies.

## Troubleshooting

- **Not signed in:** run `gvoice login`, finish Google's prompts, and close the
  browser window.
- **Chrome cannot launch:** confirm Google Chrome is installed, or set
  `GVOICE_CHROME_CHANNEL` to an installed Playwright-supported channel.
- **No items or selector errors:** run `gvoice open` to confirm the inbox loads.
  Google may have changed the web app and a code update may be needed.
- **Wrong account:** use a different `GVOICE_PROFILE_DIR` to create a separate
  dedicated browser profile.

## Development

```sh
npm ci
npm run check
npm test
```

Security reports should follow [SECURITY.md](SECURITY.md). Contributions should
preserve the read-only boundary and include tests for behavior changes.

## License

[MIT](LICENSE)
