# Implementation state

| ID | Behavior | Status | User accepted? | Source evidence | Runtime/test evidence | Last checked |
|---|---|---|---|---|---|---|
| IMP-01 | Research graph stores papers, ecosystems, and relations in workspace state. | implemented | unknown | `src/data/defaultState.js`, `src/store/workspaceStore.js` | Local UI opened at `http://127.0.0.1:43127/`; sample graph rendered. | 2026-10-24 |
| IMP-02 | AI Hub accepts free-form idea or paper input, builds the prompt locally, and exposes external-model and BYOK API execution paths. | implemented | not reviewed | `index.html`, `src/views/aiHubView.js` | Post-change browser/runtime review not run. | 2026-10-24 |
| IMP-03 | AI output parsing preserves missing values, rejects unstructured responses as drafts, and does not synthesize papers or relations. | implemented | not reviewed | `src/views/aiHubView.js` (`extractPapersFromParsedObject`, `parseRawAiOutputToGraph`, `normalizeParsedObject`) | Static source review only; parser not executed. | 2026-10-24 |
| IMP-04 | Imported relations require a label and a quoted source with a valid HTTP(S) URL; gap results are worded as candidates. | implemented | not reviewed | `src/views/aiHubView.js`, `src/engine/gapEngine.js`, `src/views/inspectorView.js` | Static source review only; graph runtime not exercised after edits. | 2026-10-24 |
| IMP-05 | AI-origin papers retain model/provider/mode provenance and `sourceStatus: unverified`; preview and graph inspector show source evidence. | implemented | not reviewed | `src/views/aiHubView.js`, `src/views/inspectorView.js` | Static source review only; optional fields use existing workspace JSON. | 2026-10-24 |

