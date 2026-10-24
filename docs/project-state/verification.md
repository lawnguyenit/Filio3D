# Verification and gaps

| ID | Claim/check | Result | Evidence | Gap or next action | Owner |
|---|---|---|---|---|---|
| CHK-01 | Pre-change AI Hub screen and navigation can be opened locally. | pass | Playwright opened `http://127.0.0.1:43127/`; existing sample graph and AI Hub rendered. | This proves visible pre-change UI only. | Codex |
| CHK-02 | Post-change workflow, parser, and API calls work. | not-run | No post-change browser/runtime review or API request was performed. | User requested implementation, not verification; ask to verify when desired. | Codex |
| GAP-01 | Search and citation verification are available through configured API calls. | not-available-in-current-connector | Provider calls are direct generation requests; the prompt says no web search/URL retrieval in this path. | External model tools may search if provided by that application; source verification remains a user step. | Codex |
| GAP-02 | Research gap recommendations are complete and evidence-backed across the literature. | not-established | Gap engine only derives candidates from `refute`/`conflict` graph relations. Relations imported in this slice require a label, quote, and URL, but those sources are still marked unverified. | Next phase: model explicit candidate gaps, show coverage bounds and compare source evidence before presenting a gap question. | Codex |
| GAP-03 | Staged draft fields can be edited inline before ingestion. | not-available | Current review modal is read-only; it displays missing fields and source evidence. | Add field-level correction controls if the user wants edit-before-ingest instead of editing a paper after graph insertion. | Codex |
| GAP-04 | BYOK keys are stored and transmitted with production-grade secret handling. | not-established | `workspaceStore.js` stores key records as JSON in browser `localStorage`; Gemini/OpenAI calls originate in the browser, while Claude uses `/api/ai-proxy`. | Personal local use is supported by the current workflow; review storage and proxy behavior before broader sharing. Workspace data also syncs to Cloudflare when a valid session token is active. | Codex |

