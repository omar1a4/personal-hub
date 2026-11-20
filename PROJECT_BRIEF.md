# Personal Hub

Living product brief. Updated: 2026-11-20.

## Current authorized milestone: daily journals and course submission (2026-11-20)

This section supersedes earlier scope restrictions below. The owner asked to pause course development, implement study and sleep/dream daily journals, connect them to the existing assistant, and publish a submission website plus a GitHub repository. The owner explicitly authorized repository creation/updates and publication, while preserving their Technion Copilot setup.

Implemented: additive SQLite journal storage, separate durable home/day conversations, summaries for long histories, structured study sessions and satisfaction, sleep/dream/habit reports, same-date updates, revision restore, JSON export, cross-journal assistant retrieval with validated source links, and manual search. Backend checks enforce owner access. The existing Windows OAuth/ChatGPT plan route and existing app data directory are unchanged. No new paid API path was introduced.

Submission boundary: a public static demo contains fictional records and supports real browser-local editing, saving, search, and revisions. It labels that no live AI is connected. The real assistant and private journals run in the Windows app. GitHub Pages cannot host that Electron/SQLite backend; hosted private AI, cloud sync and public/private server deployment are future work. Personal journals, conversations, credentials and uploaded course content must stay out of Git.

Verification: 17 automated tests passed on Node 24 in the development environment, including existing course regressions and new journaling persistence, restore, authorization, partial failure, context and retrieval tests. Browser testing verified reports survive refresh, later dream fragments update the same day, prior versions restore, cross-journal search returns matching dated entries, and the 390px layout renders correctly. New journal AI behavior is tested with synthetic runtimes; one live Windows-account journal conversation remains for the owner to try. Historical real connection-test evidence below does not establish new live-flow verification.

Publication status: published on 2026-11-20. Source: https://github.com/omar1a4/personal-hub . Website: https://omar1a4.github.io/personal-hub/ . GitHub Pages serves main/docs. The live dashboard and cross-journal keyword search were verified in a browser. The Technion Copilot connection and account settings were not changed; no Copilot agent was used.


## Authorized Education Workflow (2026-11-17)

The owner authorized moving beyond the connection test in four implementation stages: (1) durable per-lecture chat and restored model context, (2) Home -> Education -> Courses navigation, (3) original uploads -> real AI processing -> saved editable lecture draft, and (4) reviewed chat-driven changes, inline breakthrough annotations, and revision/undo history.

- Courses: Algorithms, Operating Systems, and AI Course. Algorithms has Lecture 1 through Lecture 13, each with a stable ID, separate content, files, and conversation. All actual lectures start empty; do not invent topics or seed sample notes. Keep the binary-search demo separate.
- Home also lists Health, Sleep & Dreams, and Spirituality as private, planned sections.
- Empty lectures invite multiple images/PDFs, numbered thumbnails, reordering, and an explicit Build lecture action. Retain originals beside the generated material. Support Hebrew and English, properly rendered mathematics, source image/PDF-page references, and explicit uncertainty rather than guessed handwriting or missing facts.
- Persist messages, lecture association, content/revisions, uploads/order, and annotations in application-side storage outside Git. Test browser refresh and server restart, lecture isolation, and saving/undoing edits. Only acknowledge a save after storage succeeds.
- Supply current lecture content, relevant sources and conversation history to later requests. Keep original history; use durable summaries and lecture-scoped selective retrieval as conversations grow, without silently dropping decisions.
- Education is intended for public reading after deployment; private chats, unpublished uploads/drafts, and learning records must not become public automatically. Editing, processing, and assistant actions remain owner-only. Preserve the existing official account connection, protected credentials, and ChatGPT plan-usage billing path. No deployment is authorized.

Implementation is in progress; the connection-test results below are historical evidence, not a claim that the new workflow is already verified.

## Current State

The owner authorized implementation of the Windows-local connection test on 2026-11-16. That test is implemented and one real ChatGPT plan-usage response has completed. The broader first milestone is not complete: annotation proposal, review/apply, persistent changes, and undo are not implemented yet.

Official documentation was reviewed on 2026-11-16. The owner completed official sign-in, confirmed the connected account as owner, and reported a completed response. The backend independently recorded a nonempty completed inference with sample lecture context at 2026-11-16T21:12:17.478Z. This verifies eligibility and plan usage for that connection/request, not unlimited usage or hosted-app approval.

### Connection Test Results (2026-11-16)

- Node.js, npm, and Git were absent from PATH and standard installation locations. Installed checksum-verified portable Node 22.23.5 with npm 10.9.9 under ignored `.tools/`; no system-wide installation or administrator access was used. Git was not needed for the pinned official source archive.
- Built the official local DevKit at commit `0a36fefeb913055c8c7a1a29b63d82b96b2e841a`. A compatible `undici` security update resolved the dependency audit finding; the updated DevKit dependency set and project audit reported zero vulnerabilities at verification time.
- Implemented a plain browser interface with a sample binary-search lecture, connection status, explicit owner confirmation, account-specific model discovery, a question input, streamed real text, stop/disconnect controls, and a usage-management link. Fonts and icons are served locally.
- The local backend runs in Electron 45.3.3 to use its supported Windows DPAPI-backed `safeStorage`. A two-process synthetic test verified encryption, decryption after process restart, and rejection of invalid ciphertext. No real credentials were used in that test.
- OAuth credentials and the pinned owner profile are encrypted outside the repository under `%APPDATA%/Personal Hub Connection Test/connection`. No OAuth tokens are exposed to browser JavaScript or logs. Windows DPAPI protects against other Windows users, not malicious code already running as this Windows user. The pinned Electron version still supports the synchronous storage API; migrate to its asynchronous replacement before upgrading to Electron 46.
- The backend binds to `127.0.0.1` on an available port. Its browser launch uses a one-time local bootstrap capability, exchanged for an HttpOnly, SameSite=Strict session cookie. Exact Host/Origin checks and CSRF validation protect mutations. The local session expires after eight hours; relaunch to create a fresh session. The owner explicitly approves the verified SDK profile, which is pinned for subsequent requests. A different signed-in profile cannot use the assistant.
- Five focused tests passed: unauthorized/origin/CSRF/forged-host/bootstrap-replay rejection; owner and plan-permission checks; lecture context and successful stream handling; incomplete/empty/error handling without raw-error leakage; and local static assets/browser security headers. These tests use explicitly synthetic fixtures, not proof of real AI usage.
- Browser checks at 1440px and 390px found no horizontal overflow; bundled fonts and icons loaded. The separate unauthorized preview correctly blocked assistant controls.
- Real verification: the owner reported a completed response in the authorized browser window. The production backend recorded `completed: true`, `nonempty: true`, and `lectureContextIncluded: true` (50 response characters). It records completion only after the official SDK has received `response.completed`. The record contains no prompt, answer, account identity, or tokens. Answer quality was not independently inspected.
- No separately billed API key, deployment, hosted approval, private-area implementation, editing, annotation persistence, or undo was involved. Chat messages are held only in process/browser memory and are not saved to disk; encrypted connection state and the owner binding persist separately.

Implementation decision (2026-11-16): Use a minimal browser UI plus an Electron main-process backend for this Windows test, reusing the official OAuth runtime and OS-backed storage. This avoids implementing OAuth ourselves or requiring the macOS-only full example. The production website stack remains open. See [README.md](README.md) for local setup, restart, and verification commands.

## Product Vision

A beautiful, mobile-friendly personal website combining public Education pages with private personal areas, growing through conversations with an embedded AI assistant. Long term, it should be installable on a phone and share content across devices.

Main areas:
- Education (first focus).
- Health.
- Sleep and dreams.
- Spirituality and self-understanding, including personal observations.

Education is organized as courses -> lectures, tutorials, homework, and exams -> individual pages. Navigation should provide a clear mental map and connections between related concepts across pages. Ordinary sections and subsections should be configurable content where practical.

## First Milestone: Local Lecture and Real Assistant

Scope decision (2026-11-16): The embedded assistant is the backbone of the product. Test a real official account connection immediately alongside one visually polished sample lecture at Education -> Algorithms. This replaces the earlier mock-chat-only milestone and brings minimal persistence and undo forward.

Acceptance criteria:
- Clear navigation showing where the lecture sits within the course and Education.
- A readable lecture with mathematical formatting.
- Official Sign in with ChatGPT account connection, explicit ChatGPT plan-usage consent, and a successful, nonempty AI response through the authorized plan-usage route. A connected badge alone is not proof of working inference.
- The real assistant receives the current lecture content and can answer a question about a specific statement in it.
- The owner can ask for a breakthrough annotation beside an identified statement or equation. The assistant proposes a targeted change through an explicitly implemented application operation; it does not silently alter the page.
- The owner can review the proposed text and attachment point, then apply or reject it. Applying to public lecture content must clearly indicate that the selected annotation is intended for publication, without publishing private chat history. Nothing is remotely published in this local milestone.
- The applied annotation appears as a clickable light bulb beside the statement. It expands inline between the surrounding proof lines and collapses back to the clean proof.
- The change survives a page refresh and can be undone after refresh. Persist the minimal revision data locally; verify that undo also survives another refresh.
- A responsive layout suitable for both phones and desktop screens.
- Clearly labeled sample content, not personal notes or claims of real course material.
- Assistant access, proposals, apply, and undo are owner-only and enforced by the local backend. Another identity must not gain owner privileges by signing in.
- Visually distinguish public Education from owner-only Health, Sleep and dreams, Spirituality, and personal reflections. Those other areas remain sample placeholders, not implemented private features. Clearly distinguish real local account connection and owner checks from unimplemented hosted authentication/access controls.
- Any unfinished chat UI remains labeled as a mockup and does not satisfy this milestone's real-assistant requirement.

Uploads and photo processing, general-purpose editing, full revision management, broad annotation re-anchoring through arbitrary edits, multi-user signup, hosted authentication, cloud storage/sync, deployment, and learning analytics remain later work. Use stable statement identifiers and a small local revision store for this single-lecture workflow; do not build a general content platform yet. Reading on the website comes first; PDF export can come later.

### Sign in with ChatGPT: Documented Path

Research date: 2026-11-16. These are documented capabilities and constraints, not locally tested results.

- **Local personal prototype:** The cookbook explicitly includes personal projects that run locally. Eligible ChatGPT Plus and Pro users can authorize eligible requests against their ChatGPT plan allowance or available credits. A paid account alone does not prove eligibility, consent, model availability, or remaining usage.
- **Official connection:** Use the official OAuth/OIDC flow with PKCE, state and nonce validation, a stable installation host ID, dynamic client registration, and verification of the returned identity and granted scopes. No API key or client secret is needed for this local registration flow. Identity sign-in alone is insufficient; plan usage requires the separate `chatgpt.tokens.use.direct` permission (with the documented resource scopes).
- **Local shape (implemented for the connection test):** A browser lecture UI backed by a loopback-only Electron main process using the official DevKit's local Node.js runtime. Sign-in, tokens, model requests, and owner authorization stay in that process, not in browser JavaScript. The DevKit offers `@siwc/local` and optional `@siwc/react` as repository workspaces; our test uses the local SDK from pinned official source. Windows connection and inference were verified as recorded above; the complete Paste Perfect example itself requires macOS.
- **Inference:** Discover models for the connected account, then use its OAuth access token with the public Responses API at `https://api.openai.com/v1/responses`, not undocumented ChatGPT endpoints. Set `store: false` and `stream: true`, send the required context in the input array, and count success only after `response.completed`. Handle failed, incomplete, interrupted, and usage-limited streams without applying a change.
- **Context and tools:** HTTP continuation does not provide persisted conversation state: omit `previous_response_id` and supply relevant history and lecture context explicitly. Function/custom tools are supported under the documented namespace or `additional_tools` rules, but hosted file search and several other hosted tools are not. Implement a narrow annotation-proposal operation and validate its target and payload locally; model output never grants permission to mutate content.
- **Billing boundary:** This OAuth plan-usage route is distinct from ordinary API-key billing. Do not assume a ChatGPT subscription covers ordinary API usage. Show when the ChatGPT plan is being used and provide usage management. Do not switch to separately billed API usage, purchase credits, or change spending settings without discussing it with the owner and obtaining approval.
- **No imported history:** Connection does not grant access to existing ChatGPT conversations or other account context. Memories are not automatically imported; Personal Hub supplies its own lecture context and private conversation state.

### Local Security and Hosted Access

- Keep OAuth access/refresh tokens and credential profiles out of Git, logs, screenshots, browser storage, and model context. Store credentials outside the repository in protected OS-backed storage; verify the Windows implementation before real sign-in. Add appropriate ignore rules before generating local state. Ordinary API credentials, if ever separately approved, also remain backend-only.
- The DevKit requires an application-supplied `credentialEncryption` provider and has no plaintext fallback. Its example uses Electron main-process `safeStorage`; a standalone Node runtime needs its own OS-backed implementation. Validate encryption and decryption across restart with synthetic credentials before connecting the real account.
- Bind the prototype backend to loopback, not a public interface. Establish the authorized owner deliberately using verified identity, with backend session and origin/CSRF protections. Neither localhost binding nor a successful ChatGPT sign-in alone is sufficient owner authorization. Deny assistant and mutation requests from unapproved identities.
- Persist lecture revisions separately from private conversations and credentials. Review and apply only selected annotation content; do not expose source chat history or personal learning records on public pages.
- **Eventual remotely hosted website:** Local eligibility does not authorize remote hosting. The cookbook directs paid or remotely hosted apps to request access through the official interest form before offering the integration to users. The quickstart describes limited availability for commercial identity integrations and selected private plan-usage clients. Treat hosted plan usage and hosted sign-in availability as access gates, not settled permissions.
- The self-hosted VM guide specifically covers running an open-source app on a remote VM, with its own host ID, local OAuth, secure transfer of protected credentials, and VM-managed refreshes. It notes that host-specific usage attribution and revocation for transferred sessions are not yet available. This is not blanket approval for the eventual remotely hosted website. Confirm the intended deployment's eligibility and access requirements with OpenAI before relying on this route remotely.
- A hosted website must implement its own sessions and server-side authorization for private pages, assistant access, mutations, images, and files. ChatGPT identity does not grant owner status to other signups. Public Education remains readable without sign-in.

### Blockers and Smallest Next Step

The authorized local connection test succeeded with the owner's account; no current local integration blocker was observed. Future requests remain subject to account/workspace eligibility, consent, model availability, and usage limits. Windows storage and the pinned local SDK were tested, but hosted access has not been requested or approved. Real credential refresh/expiry, revocation failure, and account-recovery scenarios have not been independently exercised end to end.

Next small implementation stage, after agreement: extend this same local setup with one stable statement identifier and an assistant-proposed annotation that the owner reviews, applies, persists across refresh, and can undo. Do not silently switch billing paths if later plan-usage requests fail. Broader private content, uploads, hosted authentication, and deployment remain out of scope.

### Official Sources

- [Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart).
- [Sign in with ChatGPT cookbook](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt), including local eligibility and hosted-app access policy.
- [Plan-usage overview](https://developers.openai.com/siwc/token-sharing-open-source).
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
- [Official DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit), including setup and its noncommercial license.
- [DevKit credential security](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/docs/security.md).
- [Self-hosted VM guide](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).
- [Hosted-app access interest form](https://openai.com/form/sign-in-with-chatgpt-interest/).

## Target Lecture Workflow (Later)

1. Create a lecture page and upload whiteboard photos.
2. Show numbered thumbnails, preserve original images, and allow easy reordering before processing. Use capture timestamps when available to suggest order, but let the user confirm it.
3. Have the assistant turn the material into a beautifully formatted, editable lecture page with mathematical notation, proofs, diagrams, and examples. Flag unclear handwriting rather than inventing content.
4. Read the lecture and discuss confusing points with the assistant.
5. Incorporate explanations into the relevant part of the page, preserving revision history and allowing undo.
6. Include interactive examples where useful. Prioritize direct website reading over PDF export.

## Breakthrough Annotations: Core Feature

Preserve how the user came to understand an idea, not just the final explanation.

Place a clickable light bulb beside the exact statement or equation that caused confusion. Clicking expands the explanation inline, between the surrounding lines of the proof. Clicking again collapses it, restoring the clean proof.

An explanation can include:
- The user's original confusion.
- The connection or insight that resolved it.
- A link to the relevant earlier lemma or theorem.
- A concrete example or, eventually, an interactive demonstration.

Annotations must remain attached to the correct content as the page is edited. The first milestone uses stable statement identifiers for its targeted annotation, persistence, and undo. Reliable anchoring through broader content edits remains a later implementation requirement whose design is open.

Published breakthrough annotations are part of public lecture content, separate from private chat history. Publishing a selected explanation must not expose the underlying conversation or personal learning records.

## Assistants and Context

Start with one real lecture assistant in the first milestone. Later, add a general hub assistant, course-level assistants, and assistants within other pages. Use compact summaries and retrieve relevant material when needed instead of loading everything into every conversation. A lecture assistant should understand its lecture and, as the course grows, access relevant course context.

The chat interface should support minimizing, split-screen reading, and expanded conversation.

The VS Code development agent builds the product. The embedded assistant manages content only through explicitly implemented application tools. It will use an OpenAI integration; it does not automatically inherit the user's ChatGPT account, memories, or conversations.

Only the authorized owner may access the embedded assistant or instruct it to change the website. Assistant conversations remain private unless the owner explicitly publishes selected content.

## Teaching Preferences

- Use concise explanations and many concrete examples.
- Do not reveal exercise solutions unless explicitly requested.
- Help the user reason step by step and preserve their own understanding.

These preferences apply to development collaboration and to the future embedded assistant.

## Learning Tracking (Later)

Track lecture status, dates, reviews, and unresolved questions. Record what the user recalled independently versus what required hints, including reconstruction of algorithms, proofs, and runtime analysis.

Eventually provide a review calendar, progress indicators, and statistics that suggest review intervals based on actual recall history. Do not present unsupported estimates as measured mastery.

## Privacy and Portfolio

The project should contribute to a GitHub portfolio and eventually be linked from LinkedIn. Plan for a public introduction and demo using fictional content alongside authenticated private areas.

Access decision (2026-11-16): Share educational content publicly while keeping personal areas and activity private and all website changes under the owner's control.

- Education pages are publicly readable without signing in.
- Health, sleep and dreams, spirituality and self-understanding, and personal reflections/observations are private and accessible only to the authorized owner account.
- Signing up does not grant another person access to the owner's private areas.
- Only the owner may edit content, upload material, or instruct the assistant to change the website. Enforce these permissions on the server.
- Access to the embedded assistant itself is owner-only; public Education access does not include assistant access.
- Assistant conversations and personal learning records remain private unless the owner explicitly publishes selected content. Public lecture pages and published breakthrough annotations are separate from private chat history; reading a public page does not grant access to its source conversations or learning records.
- Keep private notes, photos, conversations, health information, and credentials out of public repositories.
- Protect all private content, including images and files, with server-side authorization, not merely hidden tabs or URLs.
- Keep API credentials on the server.
- Treat repository visibility and website access as separate decisions. Individual folders within a public repository cannot be assumed private.
- Decide hosting, authentication, storage, and repository structure before publishing.

## Staged Roadmap

Stages after the first milestone are provisional; refine their scope and order as decisions evolve.

1. **Planning (established; maintained continuously):** Record the vision, milestone boundaries, decisions, and tested status.
2. **Local lecture and real assistant (current first milestone):** Official connection, local owner checks, sample lecture context, and one completed ChatGPT plan-usage response are verified. Next deliver the owner-reviewed annotation proposal/apply/persist/undo workflow. No remote deployment or API-key fallback.
3. **Content foundation:** Extend minimal local persistence into editable pages, original-photo uploads and ordering, broader revision history, undo, and annotation anchoring. Resolve privacy and storage decisions before introducing real personal data.
4. **Assistant expansion:** Extend the real integration with photo-to-lecture processing and uncertainty flags, course/hub assistants, summaries, retrieval, and the planned chat modes. Check each capability against the plan-usage route's supported features.
5. **Public Education and hosted owner-only access:** Resolve OpenAI hosted-integration access before deploying plan usage. Implement and verify public Education reading without sign-in, owner-only private access (including images and files), and owner-only assistant access, editing, uploads, and assistant changes. Keep chats and learning records private, with explicit publication of selected content. Publish a fictional-content introduction/demo and protected private areas only after hosting, storage, and repository decisions are settled. Enable shared content across devices and eventual phone installation.
6. **Learning and broader hub:** Add recall-based review tracking, calendars, and statistics; expand beyond Education. Add richer interactive examples and optional PDF export as useful.

## Open Decisions

- Broader product technology stack and mathematical rendering; the connection-test setup is implemented, not a final hosted architecture.
- A minimal durable annotation revision store and stronger lifecycle/recovery testing for the verified local owner/credential setup.
- Continuing account/workspace eligibility and usage allowance; one request worked, while hosted integration approval remains unresolved. Separately billed API usage requires a new discussion and explicit approval.
- Visual direction, illustrative Algorithms topic, and the specific confusion/insight for the sample annotation.
- Navigation and cross-page concept links as content grows.
- Editable content format and how annotations retain their attachment through revisions and undo.
- Image storage, timestamp handling, and processing approach.
- OpenAI model choices, costs, summary/retrieval strategy, and implementation of owner-only permissions for content-changing tools.
- Hosting, authentication, storage, and repository structure/visibility before publishing; implementation of the agreed public/owner-only access model and separation of fictional demo and private content.
- Workflow for explicitly publishing selected explanations or learning content without exposing private chats, records, images, or files.
- Cross-device synchronization and phone installation approach.
- Recall records and review scheduling based on evidence rather than unsupported mastery scores.

## Maintaining This Brief

Keep agreed decisions, current implementation status, and open questions distinct. Update this brief when scope or decisions change, including the date and a short rationale for significant choices. Do not silently turn long-term goals into first-milestone requirements or describe planned features as working.