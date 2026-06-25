# OtakuDeck

Cross-platform MyAnimeList client for **Windows** and **Android**.

## Quick start

```bash
npm run setup          # install deps, create .env, generate icons
# Edit .env → set VITE_MAL_CLIENT_ID
npm run tauri:dev      # Windows
npm run tauri:android  # Android (after android init)
```

See **[SETUP.md](./SETUP.md)** for full testing instructions.

## Features

- OAuth 2.0 + PKCE (desktop localhost + Android deep link)
- **Home** — AI suggestions, seasonal news, airing anime
- **Archive** — search, filters, infinite scroll
- **List** — synced MAL list with stats accordion
- **Modal** — details, status, episodes, score, instant sync

## MAL redirect URIs (register both)

```
http://127.0.0.1:14568/callback   ← Windows
otakudeck://callback              ← Android
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | First-time project setup |
| `npm run tauri:dev` | Windows dev mode |
| `npm run tauri:build` | Windows release build |
| `npm run tauri:android` | Android dev mode |
| `npm run tauri:android:build` | Android release build |

## Stack

Tauri 2 · Rust · React 19 · TypeScript · Vite · MAL API v2
