# pi-agy

[![npm version](https://img.shields.io/npm/v/pi-agy?logo=npm)](https://www.npmjs.com/package/pi-agy)
[![license](https://img.shields.io/npm/l/pi-agy)](LICENSE)

**pi-agy** is a [Pi Coding Agent](https://github.com/earendil-works/pi) provider that lets Pi talk directly to Google Antigravity / Cloud Code Assist models — Gemini, plus the Claude and GPT-OSS models Antigravity also advertises. Sign in with Google, pick a model, and go. Under the hood it handles OAuth login, native streaming, model routing, quota diagnostics, and optional multi-account failover itself, so it never shells out to an external Antigravity CLI.

> **Unofficial integration.** This project is not affiliated with or endorsed by Google. Use it only with an account and services you are authorized to access, and review its source before granting OAuth permissions.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Authentication and credential safety](#authentication-and-credential-safety)
- [Commands](#commands)
- [Models and routing](#models-and-routing)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Requirements

- Pi Coding Agent and Pi AI version **0.80.0 or later**
- A Google account that can use the relevant Cloud Code Assist / Antigravity services
- A browser to complete the Google sign-in. Same-machine is best (the browser hits the local callback automatically); on a remote/headless machine, complete sign-in anywhere and paste the resulting callback URL back into Pi (see [Troubleshooting](#troubleshooting)).

## Install

Install directly from npm:

```bash
pi install npm:pi-agy
```

Restart Pi (or run `/reload`) after installation. To update the npm package later, use `pi update npm:pi-agy`.

## Quick start

1. Start Pi and run `/login antigravity` to link your Google account.
2. To link additional accounts for automatic quota failover, run `/login antigravity` or `/antigravity` and choose **➕ Add new account**.
3. Manage linked accounts, switch active preference, or check quotas across all accounts with `/antigravity` or `/antigravity.accounts`.
4. Select a model, for example:

   ```text
   /model antigravity/gemini-3.8-flash
   ```

5. Start working. If the active account returns HTTP 429, the provider tries each linked account in order and keeps using the first successful one. If a request fails, run `/antigravity.doctor` for sanitized diagnostics.

## Authentication and credential safety

The provider uses the OAuth 2.0 Authorization Code flow with PKCE, so credentials are only ever exchanged with Google — never typed into Pi.

1. `/login antigravity` opens Google sign-in (or the account management menu if already logged in) and starts a temporary callback listener at `http://localhost:51121/oauth-callback`.
2. After you approve access, Pi exchanges the callback code for tokens and stores the provider credentials in Pi's auth store (normally `~/.pi/agent/auth.json`).
3. Pi refreshes access tokens automatically when they expire — you shouldn't need to sign in again unless a token is revoked.

Each linked account is stored under a dedicated key in `auth.json` (`antigravity` for account 1, `antigravity-2` through `antigravity-10` for additional slots). Automatic switching occurs seamlessly on pre-stream HTTP 429 quota exhaustion.

The callback listener binds only to a loopback host, so it isn't reachable from outside your machine. The auth file it writes to contains sensitive access and refresh tokens: **do not commit it, paste it into issues, or share its contents.**

Signing in requests these Google OAuth scopes:

| Scope                                | Why it's needed                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `aicode`                             | Access to the Cloud Code Assist / Antigravity model catalog and endpoints |
| `cloud-platform`                     | General Cloud Code Assist API access                                      |
| `userinfo.email`, `userinfo.profile` | Identify the signed-in Google account                                     |
| `cclog`                              | Cloud Code Assist logging/telemetry endpoints used by the API             |
| `experimentsandconfigs`              | Server-side experiment and config flags for the API                       |

Review these permissions before approving access. If your credentials expire or are revoked, just re-run `/login antigravity` to sign in again.

## Commands

| Command                         | Description                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/login antigravity`            | Sign in or open interactive account management (add, switch, quotas, remove).                    |
| `/model antigravity/<model-id>` | Choose a registered Antigravity model.                                                           |
| `/antigravity`                  | Open interactive Antigravity account manager dashboard.                                          |
| `/antigravity.accounts`         | Open interactive Antigravity account manager dashboard.                                          |
| `/antigravity.doctor`           | Show sanitized provider diagnostics, including the endpoint, status, and resolved runtime model. |

Model availability, entitlement, quota groups, and resets are returned by the service and can differ by account. The quota percentage shown for a model can represent a shared pool, not a private per-model allowance.

## Models and routing

The static model IDs registered by this extension match the Cloud Code Assist catalog, verified against the live backend. Use `/antigravity.models` to see live availability and quota for your account - the table below is a reference for what each public model ID maps to.

`agy models` (CLI 1.4.0, probed 2026-10-07) advertises Gemini 4 Argon, Gemini 3.8 Flash, Claude Sonnet 5.5, Claude Opus 5.5, and GPT-OSS 120B. Pi registers all five plus `gemini-3.5-flash-lite`, which the API serves even though the CLI does not list it.

Model availability depends on the User-Agent family. With `antigravity/1.15.8 <os>/<arch>`, what this extension sent before, this account got a 23-id catalog and `gemini-4-argon-*` answered 404 while `agy models` listed those models as available. `antigravity/cli/1.4.0` returns a 29-id catalog that includes Gemini 4 Argon and serves every runtime in the table below, so the `cli` form is the default now. The measurement sits next to `defaultUserAgent` in `src/client/client.ts`, and `ANTIGRAVITY_USER_AGENT` overrides it if Google moves the floor again.

On 2026-10-07 the backend retired the models this extension used to expose. Gemini 3.7 Flash, Gemini 3.6 Flash, and Gemini 3.1 Pro return 404, and Gemini 3.5 Flash, Claude Sonnet 4.6, and Claude Opus 4.6 answer with a "no longer available" message instead of the model. Those IDs are no longer registered, so `/model` only offers IDs that answer. The check was repeated with the `cli` User-Agent, so it is not an artifact of the old UA.

### Why Claude and GPT-OSS appear

Antigravity / Cloud Code Assist exposes a multi-provider catalog. Depending on your account, its Google-authenticated API can advertise Google Gemini models alongside Claude models served through Anthropic Vertex and GPT-OSS served through OpenAI Vertex. This extension intentionally exposes those advertised Claude and GPT-OSS models through the single `antigravity` provider; they are not separate Pi providers and do not use a separate Anthropic or OpenAI login.

The backend's display labels do not always match its runtime IDs. Gemini 3.8 Flash is a single `-tiered` runtime that receives Low, Medium, or High through `generationConfig.thinkingConfig`. Claude 5.5 ships effort-specific runtime IDs (`claude-sonnet-5-5-low`, `-medium`, `-high`). Gemini 3.5 Flash Lite has no effort selector at all.

| Public model ID         | Input       | Thinking levels shown | Max output tokens | Request routing                                                                                     |
| ----------------------- | ----------- | --------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `gemini-4-argon`        | Text, image | Low, Medium, High     | 65,536            | low → `gemini-4-argon-low`; medium → `gemini-4-argon-medium`; high → `gemini-4-argon-high`          |
| `claude-opus-5-5`       | Text, image | Low, Medium, High     | 128,000           | low → `claude-opus-5-5-low`; medium → `claude-opus-5-5-medium`; high → `claude-opus-5-5-high`       |
| `claude-sonnet-5-5`     | Text, image | Low, Medium, High     | 128,000           | low → `claude-sonnet-5-5-low`; medium → `claude-sonnet-5-5-medium`; high → `claude-sonnet-5-5-high` |
| `gemini-3.8-flash`      | Text, image | Low, Medium, High     | 65,536            | `gemini-3.8-flash-tiered` + `thinkingLevel` Low/Medium/High                                         |
| `gemini-3.5-flash-lite` | Text, image | High                  | 65,535            | `gemini-3.5-flash-lite` (no effort selector)                                                        |
| `gpt-oss-120b`          | Text        | Medium                | 32,768            | medium → `gpt-oss-120b-medium`                                                                      |

To limit which models Pi cycles through, enable specific entries in `~/.pi/agent/settings.json`:

```json
{
  "models": {
    "antigravity/claude-opus-5-5": { "enabled": true },
    "antigravity/claude-sonnet-5-5": { "enabled": true },
    "antigravity/gemini-4-argon": { "enabled": true },
    "antigravity/gemini-3.8-flash": { "enabled": true },
    "antigravity/gemini-3.5-flash-lite": { "enabled": true },
    "antigravity/gpt-oss-120b": { "enabled": true }
  }
}
```

## Configuration

All primary environment variables start with `ANTIGRAVITY_`. The legacy `NOAGY_` prefix is also accepted for compatibility.

| Variable                    | Purpose                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ANTIGRAVITY_BASE_URL`      | Override the API base URL. It must be HTTPS, contain no URL credentials, and target an allowed Google APIs host.              |
| `ANTIGRAVITY_PROJECT_ID`    | Use a specific Cloud Code Assist project ID instead of discovery or the stable account fallback.                              |
| `ANTIGRAVITY_CALLBACK_HOST` | Bind OAuth callback to `127.0.0.1`, `::1`, or `localhost` only. Defaults to `127.0.0.1`.                                      |
| `ANTIGRAVITY_USER_AGENT`    | Override the request user-agent. Keep it in the `antigravity/cli/` family or preview models such as Gemini 4 Argon disappear. |
| `ANTIGRAVITY_RUNTIME_MODEL` | Pin requests to a runtime model ID, bypassing normal static routing.                                                          |
| `ANTIGRAVITY_CLIENT_ID`     | Use a custom Google OAuth client ID.                                                                                          |
| `ANTIGRAVITY_CLIENT_SECRET` | Use a custom Google OAuth client secret. Keep it out of source control and shell history.                                     |
| `ANTIGRAVITY_NO_KEEPALIVE`  | Set to `1` to disable the long-lived keep-alive connection pool and use Node's fetch defaults.                                |
| `ANTIGRAVITY_NO_PREWARM`    | Set to `1` to skip the TLS pre-warm request made when the extension loads.                                                    |
| `ANTIGRAVITY_HTTP2`         | Set to `1` to negotiate HTTP/2 for API requests. Off by default.                                                              |

By default, the provider tries `https://cloudcode-pa.googleapis.com` and then its Google sandbox fallback if necessary. Prefer the built-in OAuth client unless you have a reason to use your own credentials.

### Latency

Provider requests reuse a long-lived keep-alive connection pool, so consecutive turns do not repeat the DNS, TCP, and TLS handshake. The pool is scoped to this provider and does not change HTTP behaviour elsewhere in Pi. When `HTTP_PROXY`, `HTTPS_PROXY`, or `ALL_PROXY` is configured, requests instead use Pi's global proxy-aware dispatcher. The connection is also opened when the extension loads so the first message of a session skips the handshake too. For the lowest time-to-first-token, pick a fast runtime: `gemini-3.5-flash-lite` answers without a thinking selector, and `gemini-3.8-flash` with reasoning off routes to `gemini-3.8-flash-tiered` at thinking level `LOW`. Setting `ANTIGRAVITY_PROJECT_ID` also removes the project-discovery round-trip when credentials do not already carry a project ID.

## Troubleshooting

- **No credentials / 401 / 403:** Run `/login antigravity` again, then check `/antigravity.doctor`.
- **Remote/headless machine — browser can't reach `localhost:51121`:** The callback binds to loopback only, so a browser on another machine can't hit it. You have two options:
  - **Paste (no extra setup):** Run `/login antigravity`, open the shown URL and complete Google sign-in in _any_ browser. When it redirects to `http://localhost:51121/oauth-callback?…` and fails to load, copy that full URL from the address bar and paste it into the prompt Pi shows. The code is single-use and expires quickly, so paste promptly.
  - **SSH tunnel (reusable):** From the machine with the browser, run `ssh -N -L 51121:127.0.0.1:51121 <user>@<server>` and keep it open, then run `/login antigravity` on the server. The redirect to `localhost:51121` tunnels through to the local callback automatically.
- **OAuth callback will not start:** Ensure port `51121` is free and `ANTIGRAVITY_CALLBACK_HOST` is a permitted loopback address.
- **Model is unavailable:** Run `/antigravity.models`; availability is account- and service-dependent.
- **Claude/GPT tool-call schema error:** Upgrade to the latest package release. The provider adapts Pi's JSON Schema tool definitions for the Cloud Code Assist custom-tool bridge.
- **Quota or rate limit:** Run `/antigravity.usage`. A pre-stream `429` automatically advances through the linked account pool. If every linked account is limited, the final `429` is returned normally. Changing models may still draw from the same account-level shared pool.
- **An account is not used:** Run `/antigravity.accounts` and use the login command shown beside an empty slot. Logging in repeatedly with the same provider ID replaces that slot; use a different numbered ID for each Google account.
- **Need a safe diagnostic:** `/antigravity.doctor` redacts recognized secrets from its error output. Still review output before sharing it publicly.

## Development

```bash
npm install
npm run check
```

The package declares its Pi extension in `package.json` under `pi.extensions`. See the [Pi package documentation](https://pi.dev/docs/latest/packages) for package installation, manifest, and gallery conventions.

## License

[MIT](LICENSE)
