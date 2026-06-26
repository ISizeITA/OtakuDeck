# OtakuDeck

Cross-platform **MyAnimeList** client for **Windows** and **Android** (Tauri 2 + React 19).

## Quick start

```bash
npm run setup
# Edit .env → VITE_MAL_CLIENT_ID
npm run tauri:dev          # Windows
npm run tauri:android     # Android (after tauri android init)
```

See **[SETUP.md](./SETUP.md)** for OAuth redirect URIs and build details.

## Features

| Area | Highlights |
|------|------------|
| **Home** | Feed unificato, suggerimenti, continua a guardare, in onda oggi, recenti |
| **Archive** | Ricerca MAL, filtri, scroll infinito |
| **List** | Lista MAL completa, statistiche, preferenze salvate |
| **Calendar** | Watching + plan + on hold, filtri, tab stagionale, orari locali (JST→locale) |
| **Search** | Ctrl+K (configurabile), ricerca offline sulla lista locale |
| **Deep links** | `otakudeck://anime/123`, `otakudeck://list`, `otakudeck://calendar` |
| **Updates** | Manifest GitHub → banner + Impostazioni; APK nativo su Android |
| **Android widget** | “In onda oggi” (sincronizza aprendo l’app) |
| **Themes** | Scuro, chiaro, AMOLED |

## MAL redirect URIs

```
http://127.0.0.1:14568/callback
otakudeck://callback
```

## Release & updates

1. Tag `vX.Y.Z` e pubblica release GitHub con setup.exe, MSI, APK.
2. Il workflow **Release** aggiorna `updates/manifest.json` su `main`.
3. Le app controllano:  
   `https://raw.githubusercontent.com/ISizeITA/OtakuDeck/main/updates/manifest.json`

Aggiorna manualmente il campo `changelog` nel manifest quando pubblichi.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Dev desktop |
| `npm run tauri:build` | Build Windows |
| `npm run tauri:android:build` | Build APK (+ widget patch) |
| `node scripts/sync-update-manifest.mjs v0.1.2` | Aggiorna manifest locale |

## Stack

Tauri 2 · Rust · React 19 · TypeScript · Vite · MAL API v2
