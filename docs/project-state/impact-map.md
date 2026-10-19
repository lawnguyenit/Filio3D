# Impact map

| Area | Current implementation | Constraint / next boundary |
|---|---|---|
| Research questions | Active and retired questions are kept in local storage; quick create is available. | Retire action updates status. Full question editing/history and relation reassignment are not implemented. |
| Source library | Add papers and search saved source text. Paper records can exist without a question. | Citation metadata and duplicate detection are absent. |
| Notes | Quick notes save separately from questions. | Rich text, excerpts/highlights, and note linking UI are absent. |
| Collections | Sample groups and user-created empty collections persist. | Collection membership editing is not implemented yet. |
| Evidence graph | 3D canvas projection, orbit/zoom, branch/filter view, separate evidence-type edge styling. | Graph nodes and connections are mostly illustrative, not generated from all user records. |
| Evidence relation scope | The selected-source card shows a narrow-scope example. | Creating/editing persistent claim-relation records is not implemented yet. |
| Synthesis | Select sources, preview exact packet, confirm Gemini Free Tier send, view result and optionally save with provider provenance. | Live API call requires user's own key; project tier and quota are not inspectable by the app. Free Tier data-use applies; no paid fallback. |
| Edge sidebar | Manifest V3 wrapper opens the app in Edge's side panel. | Not yet loaded in Edge. It does not read active-page content or selected text. |
| Voice / page capture | Keyboard quick-capture surface is represented in the app. | No microphone workflow or page-content capture permission exists yet. |
| Backup | Export and schema-checked replace-on-import JSON. | No merge mode, encrypted sync, or automatic backup. |
| Interface | Responsive local-first visual prototype; system fonts, no third-party asset requests. | Actual Edge render and accessibility review remain pending. |
