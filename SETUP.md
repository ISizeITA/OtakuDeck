# OtakuDeck — Guida al test

## 1. Setup rapido

```powershell
cd C:\Users\laure\Projects\OtakuDeck
npm run setup
```

Poi apri `.env` e inserisci il tuo **Client ID** MAL.

## 2. Configurazione MyAnimeList API

Vai su [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) e crea un'app:

| Campo | Valore |
|-------|--------|
| App Type | **Other** |
| Redirect URI #1 | `http://127.0.0.1:14568/callback` |
| Redirect URI #2 | `otakudeck://callback` |

Registra **entrambi** gli URI — Windows usa localhost, Android usa il deep link.

## 3. Test su Windows

```powershell
npm run tauri:dev
```

1. Clicca **Accedi con MyAnimeList**
2. Autorizza nel browser
3. Torna all'app → Home / Archivio / Lista disponibili
4. Clicca una copertina → modale dettagli → modifica lista → Salva

## 4. Test su Android

**Prerequisiti:** Android Studio, SDK, NDK, Java 17+. Vedi [Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/#android).

```powershell
# Prima volta: inizializza il progetto Android
npm run tauri android init

# Dev su emulatore/dispositivo
npm run tauri:android
```

Flusso OAuth Android:
1. Tap **Accedi con MyAnimeList** → si apre Chrome
2. Dopo autorizzazione, MAL reindirizza a `otakudeck://callback`
3. Android riapre OtakuDeck automaticamente via deep link

## 5. Build release

```powershell
# Windows installer
npm run tauri:build

# Android APK/AAB
npm run tauri:android:build
```

## Risoluzione problemi

| Problema | Soluzione |
|----------|-----------|
| `MAL client ID not configured` | Controlla `.env` con `VITE_MAL_CLIENT_ID` |
| OAuth fallisce su Windows | Verifica redirect URI `http://127.0.0.1:14568/callback` su MAL |
| OAuth fallisce su Android | Verifica `otakudeck://callback` su MAL + deep-link in tauri.conf |
| Porta 1420 occupata | Chiudi altre istanze Vite o cambia porta in vite.config.ts |
| Token scaduto | L'app refresha automaticamente; se fallisce, esci e riaccedi |

## Architettura OAuth

```
Desktop:  App → localhost:14568 listener → browser MAL → callback → token
Android:  App → browser MAL → otakudeck://callback → deep-link plugin → token
```
