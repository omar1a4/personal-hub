# Personal Hub

A daily space for learning, sleep, dreams, and the connections between them.
Built for the **AI course — Avi Salmon** website assignment.

## What works

- **Education → Daily study report:** record minutes per course, effort satisfaction, reflections, and tags; see totals and a seven-day study chart.
- **Habits & sleep:** record bedtime, waking time, reported sleep duration and quality, dreams, habits, and reflections. Reopen a day to add later recollections.
- **Local assistant:** the existing ChatGPT account connection now supports each day's journal. Conversation-driven updates save a versioned entry. The home assistant searches both journals with date filters and keywords, uses aggregate statistics, and returns verified links to supporting entries.
- **Persistence:** dated entries, raw conversations, compact conversation summaries, revisions, restore, and JSON export. Separate chats for home and each journal day. SQLite records survive refresh and app restart.
- **Public demo:** fictional examples, working manual entry editing, browser persistence, history restore, cross-journal keyword search, and JSON export. **There is no live AI or owner sign-in on the public demo.**
- The existing course pages, uploads, and lecture workflows are retained. Course development is paused.

## Use the private Windows app

If you already have the previous project running, close it, copy the updated source files into that project folder, and keep your existing `.tools` and `node_modules` directories. Then run in VS Code PowerShell:

```powershell
.\scripts\start.ps1
```

The update uses the same application data directory, so existing account credentials and saved lectures remain in place. No change to your GitHub or Technion Copilot connection is needed. This code does not invoke Copilot.

For a fresh folder on Windows:

```powershell
.\scripts\install.ps1
.\scripts\start.ps1
```

The installer downloads portable Node 22 LTS and the pinned official local sign-in SDK, installs dependencies, and builds the SDK. It does not need a global Node install. Open the browser window launched by the app: its one-time launch capability creates the local session. Reuse your existing owner connection, or connect and explicitly confirm the owner when asked. Select an eligible model from that account.

Try **Education → Daily study report** and say: “I studied Algorithms for 90 minutes and Operating Systems for 45 minutes. I feel 4 out of 5 about my effort.” In **Habits & sleep**, report your night, then return to that date later with another dream fragment. From **Overview**, ask how you divided study time this week, or which dream themes recur.

These new AI flows are covered by synthetic integration tests, but still need one live run with your connected Windows account. A failed or interrupted response saves your message without replacing the entry. No separately billed API-key fallback is implemented. The existing account's model eligibility and usage limits still apply.

## Public course demo

The checked-in `docs/` directory is ready for GitHub Pages. It contains only static assets and fictional seed examples. Visitors' edits stay in their own browser's local storage; clearing site data or switching browsers loses those edits. Export first if you want a copy. The demo is not a secure place for sensitive personal journals and does not synchronize devices.

With Node installed, preview it without installing dependencies:

```sh
node scripts/demo-server.mjs
```

Open the printed local URL. With the project dependencies available, rebuild after frontend changes:

```sh
npm run build:demo
```

For GitHub Pages, use **Settings → Pages → Deploy from a branch → main → /docs**. The assignment requires the resulting website link and this source repository's link.

GitHub Pages serves the static demo. The private Electron/SQLite backend and OS-protected credentials run on your Windows computer and cannot run on GitHub Pages. A hosted private app, real hosted authentication, cross-device synchronization, and eligibility for hosted ChatGPT plan usage are separate future work.

## Data and privacy

The backend binds only to `127.0.0.1`. Owner identity, local session, Origin and CSRF checks protect all journal, conversation, search, export, and mutation endpoints. Another signed-in identity does not inherit owner access. The public page shell contains no private records.

Application data remains under `%APPDATA%\Personal Hub Connection Test`:

- `education.sqlite`: existing lectures plus new journal tables, conversations, and revisions. The journal database is not application-encrypted; it relies on your Windows account and disk protections.
- `uploads/`: existing lecture sources.
- `connection/`: OS-encrypted account credentials and owner binding.

The AI receives the selected entry, relevant conversation context, and retrieved journal records when requested. Account connection does not import your ChatGPT conversations or memories. Full original history is retained locally even when an older conversation is summarized for model context. Home retrieval uses an AI-generated search plan, date/type filters, a bounded selection of up to 24 entries, and exact statistics over the requested date range. Keyword search is not an exhaustive semantic index. Associations are tentative, not causal or clinical conclusions.

Use **Export journals** for a readable JSON backup of entries, chats, and revisions. Exported files are private; do not commit them. This release has export but not a backup-import UI.

## Verification and project structure

`npm test` runs storage, backend authorization, completion/failed-stream, context, retrieval, and revision tests. AI tests use explicitly synthetic responses; they are not a claim of live account inference.

- `web/`: browser interface and clearly separated demo adapter.
- `shared/journal-model.mjs`: shared validation, search, and statistics.
- `local/journals.mjs`: additive SQLite journal storage.
- `local/journal-assistant.mjs`: conversation continuity, retrieval, validated assistant updates.
- `local/server.mjs`: owner-protected HTTP endpoints; existing OAuth runtime is retained.
- `docs/`: public demo output, built from an explicit file allowlist.
- `test/`: automated tests. `PROJECT_BRIEF.md`: product decisions and historical connection results.

Dependencies and the official SDK retain their respective licenses. The official local SDK is downloaded by the installer; its license and usage terms apply. No credentials, personal records, course uploads, or dependency binaries belong in the public repository.
