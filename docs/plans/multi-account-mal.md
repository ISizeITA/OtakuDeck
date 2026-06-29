# Piano: multi-account MyAnimeList

Documento di progettazione per implementare **più account MAL** su OtakuDeck.  
Da eseguire **dopo** il completamento delle feature UX correnti (badge, refresh, widget, ricerca, offline).

---

## Obiettivo

Permettere all’utente di:

1. Aggiungere più account MAL (es. personale + condiviso)
2. Passare da un account all’altro senza reinstallare
3. Mantenere liste, cache e preferenze **separate per account**
4. Restare compatibili con OAuth MAL e deep link esistenti

---

## Stato attuale (v0.1.x)

| Componente | Comportamento |
|------------|---------------|
| `AuthManager` | Un solo token in memoria + storage |
| `auth/storage.rs` | File token unico in `app_data_dir` |
| `AppState.cache` | Cache condivisa (`animelist_all`, `home_feed`, …) |
| `preferences` | File unico `app.preferences.json` (notifiche, UI) |
| Frontend | `useAuth` assume sessione singola |

---

## Modello dati proposto

### Account record

```json
{
  "accounts": [
    {
      "id": "uuid-v4",
      "mal_user_id": 123456,
      "display_name": "Username",
      "avatar_url": "https://...",
      "added_at": "2026-06-26T12:00:00Z",
      "last_used_at": "2026-06-26T18:00:00Z"
    }
  ],
  "active_account_id": "uuid-v4"
}
```

### Storage per account

```
app_data/
  accounts.json              # indice account + active id
  accounts/
    {account_id}/
      auth.json              # access + refresh token (PKCE session)
      cache/                 # DataCache dedicata
      preferences.json       # opzionale: prefs legate all’account
  app.preferences.json       # globali: tema, lingua, shortcut, update
```

**Regola:** al switch account, `AppState` punta alla cache e auth del profilo attivo.

---

## Backend (Rust)

### Fase B1 — Refactor auth multi-tenant

1. **`AccountStore`** nuovo modulo:
   - `list_accounts()`, `add_account()`, `remove_account()`
   - `set_active(id)`, `get_active()`
   - Migrazione automatica: se esiste il vecchio `auth.json` singolo → crea account default

2. **`AuthManager`** per account:
   - Costruttore `AuthManager::for_account(account_id, path)`
   - `AppState` contiene `active_account_id` + `HashMap` o reload lazy

3. **Comandi Tauri nuovi:**
   - `list_mal_accounts` → elenco account (nome, id, avatar)
   - `switch_mal_account(account_id)` → swap sessione + invalida cache frontend
   - `remove_mal_account(account_id)` → logout + delete folder
   - `add_mal_account` → flusso OAuth standard con nuovo account

4. **`start_oauth_login` / `complete_oauth_login`:**
   - Parametro opzionale `account_id` (null = nuovo account)
   - Dopo login, aggiornare indice e impostare come attivo

### Fase B2 — Cache scoped

1. Spostare `DataCache::new(dir)` in `accounts/{id}/cache/`
2. Chiavi cache invariate (`animelist_all`, `home_feed`, …)
3. Al switch: **non** mescolare dati tra account
4. `get_user_animelist_all` usa sempre cache dell’account attivo

### Fase B3 — Widget e notifiche

1. Widget Android: snapshot solo dell’account **attivo**
2. Notifiche episodio: rischedulate al switch account
3. WorkManager: legge snapshot account attivo (path scoped)

### Fase B4 — Migrazione e sicurezza

1. Script migrazione one-shot all’avvio
2. Token cifrati opzionali (Windows DPAPI / Android Keystore) — fase 2
3. Logout account rimuove token da disco

---

## Frontend (React)

### Fase F1 — UI account

1. **UserMenu** → sotto-sezione “Account”:
   - Account attivo (checkmark)
   - Lista altri account → tap per switch
   - “Aggiungi account” → OAuth
   - “Rimuovi account” (con conferma)

2. **Settings** → sezione Account con stessa lista

3. Evento globale `ACCOUNT_SWITCHED`:
   - Reset `RefreshContext`, invalida list cache search
   - Chiudi modal anime aperti
   - Reload Home / List / Calendar

### Fase F2 — Stato auth

1. Estendere `useAuth`:
   - `accounts: MalAccountSummary[]`
   - `activeAccountId`
   - `switchAccount(id)`, `addAccount()`, `removeAccount(id)`

2. Landing: se nessun account → login; se account esistono ma nessuno attivo → picker

### Fase B5 — Deep link

- Deep link anime restano validi; risolti nel contesto account **attivo**
- Se anime non in lista account attivo → apri comunque modal (comportamento attuale)

---

## Ordine di implementazione consigliato

| Step | Task | Effort |
|------|------|--------|
| 1 | `AccountStore` + migrazione storage | 1–2 gg |
| 2 | Cache per-account + switch backend | 1 gg |
| 3 | Comandi Tauri + test Rust | 1 gg |
| 4 | UI UserMenu / Settings | 1 gg |
| 5 | Evento switch + invalidazione frontend | 0.5 gg |
| 6 | Widget + notifiche scoped | 0.5 gg |
| 7 | QA manuale (2 account, switch, logout) | 0.5 gg |

**Totale stimato:** 5–7 giorni.

---

## Rischi e decisioni aperte

1. **Preferenze per account vs globali**  
   - Proposta: tema/lingua globali; notifiche e streaming links per account.

2. **Limite account**  
   - Suggerito max 5 per semplicità UI.

3. **Sync parallelo**  
   - Non prefetchare tutti gli account in background (costo API MAL).

4. **Offline**  
   - Ogni account mantiene la propria cache; switch offline mostra cache di quell’account.

5. **OAuth state**  
   - PKCE `state` deve includere `account_id` o flag “new account” per evitare collisioni.

---

## Criteri di accettazione

- [ ] Aggiungo 2° account MAL e switcho senza perdere dati del primo
- [ ] Lista Home/Calendar riflette l’account attivo
- [ ] Widget Android mostra “in onda oggi” dell’account attivo
- [ ] Rimuovo account → token e cache eliminati
- [ ] Migrazione da installazione single-account trasparente
- [ ] Test Rust per `AccountStore` e switch cache path

---

## Fuori scope (v1 multi-account)

- Sync simultanea multi-account in UI split
- Import/export lista (già escluso dalla roadmap)
- AniList o altri servizi

---

*Ultimo aggiornamento: 2026-06-26 — da rivedere prima dell’implementazione.*
