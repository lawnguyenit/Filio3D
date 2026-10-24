# Impact map: AI Hub first workflow slice

| Capability | UI owner | Logic/data owner | Persistence/API | Verification |
|---|---|---|---|---|
| Idea intake and execution mode | `index.html`, `styles.css`, `src/views/aiHubView.js` | `src/views/aiHubView.js` prompt builder and event flow | No persistence/API contract change | Browser interaction review; not run after edits unless requested |
| External-model handoff and paste-back | `index.html`, `src/views/aiHubView.js` | `src/views/aiHubView.js` parsing and staging | No new service | Browser interaction review; not run after edits unless requested |
| Source/provenance fields and non-fabricating normalization | `src/views/aiHubView.js`, `src/views/inspectorView.js` | Existing paper fields plus optional `sourceEvidence`, `sourceStatus`, and provenance metadata | Stored inside existing workspace JSON; no migration expected | Static inspection; schema/runtime checks not run |
| Graph ingestion | Existing AI Hub view and `workspaceStore` | Existing `state.sources` and `state.relations` | Existing localStorage/optional Cloudflare sync | No API or authorization changes in this slice |
| Gap candidate wording | Existing graph gap cards, matrix, and inspector | `src/engine/gapEngine.js`, `src/views/inspectorView.js`, `src/views/matrixView.js` | No storage or API contract change | Static inspection; inference quality depends on user-reviewed edges and source quality |

