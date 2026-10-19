# Interaction and error-state sketch

## Main layout

- **Left rail:** workspace, new question, Explore, Source library, Source collections, Re-synthesis, active questions, and local-storage status.
- **Top bar:** current location, library search, account placeholder.
- **Explore center:** current research question, evidence graph, relation filters, and graph controls.
- **Explore right panel:** selected paper's citation, personal interpretation, scoped claim, source link, and nearby evidence relations.
- **Quick capture:** floating button / keyboard shortcut opens a modal so a note or paper can be saved without leaving the current context.

## Graph interactions

| Action | Behavior |
|---|---|
| Drag empty graph area | Orbit the 3D viewpoint; preserve the selected record. |
| Scroll / + / − | Zoom the current view. |
| Select a node | Highlight it and show its details; selecting evidence also identifies the relation type and scope. |
| Toggle one of four relation chips | Hide/show only that evidence relation class. |
| Expand / collapse branches | Show or hide backward citations, forward citations, and evidence branches; never delete records. |
| Reset / fit | Restore default orbit or fit the current focus. |

3D layout should be progressively disclosed. The focused question and selected paper stay prominent; the user expands one citation/evidence branch at a time. A conventional list and detail view serve as a stable alternative when the graph is dense or a screen reader is in use.

## Record model and lifecycle

- **Research question:** title, status (`active` or `retired`), optional note. Retiring does not remove related sources.
- **Source:** title, authors, venue/year, URL, read status, tags, personal interpretation, optional question association. A source can be referenced by multiple collections/questions.
- **Personal note:** title, body, timestamp, optional question association. Unattached notes remain in the general library.
- **Claim/evidence relation:** relation type, paper, exact claim, scope/conditions, confidence, and review status. The UI must distinguish “not assessed” from “not found in this current source set.”
- **Collection:** title and a set of source IDs. A collection does not require a central question.
- **Synthesis session:** selected source IDs, prompt/goal, reviewed packet, model/provider choice, output and provenance. Provider fields remain absent until the user chooses the workflow.

## Error and empty states

| Situation | User-facing behavior |
|---|---|
| Blank capture title | Keep dialog open and ask for a title. |
| Malformed supplied URL | Keep form values and identify the required HTTP(S) format. |
| Browser storage unavailable/full | Explain that save failed; retain entered form values; offer backup/export where possible. |
| Search has no matches | Show “No matching source” and invite a different query or a new source. |
| Relation filters remove all evidence | Show a recoverable empty overlay and keep the filter controls visible. |
| No citation metadata | Label citation direction as unavailable; do not imply an empty graph proves no citations exist. |
| Invalid JSON backup / unsupported version | Reject without overwriting current data and identify the parse/schema problem. |
| User restores a valid backup | Confirm replacement before import; preserve the current state if confirmation is declined. |
| Large/slow graph | Keep a selected focus and collapse distant branches; provide list navigation. |
| Model unavailable / context too large | Not implemented yet. Future behavior should preserve the reviewed packet and allow retry or manual export. |
| Voice permission or recognition unavailable | Not implemented yet. Future behavior should show a text-entry fallback and never discard an existing note. |

## Next user decisions after review

1. Keep the general visual direction and the 3D focus-map metaphor?
2. Which zero-cash route should the first build connect: ChatGPT Plus/Pro plan usage through the open-source local-app OAuth flow, or Gemini API Free Tier with its separate key and data-use terms?
3. Should the Edge sidebar extension be part of the first usable release, or is the responsive app enough for the first iteration?
4. Which voice behavior matters first: dictation into a note, or spoken commands that create/link records?

The selected provider is Gemini API Free Tier. The synthesis page selects sources, previews exactly what will be sent, requires a second confirmation before transmission, and stops on quota/auth/network errors. It does not switch providers or use paid fallback. The app cannot inspect project tier or remaining quota. See `gemini-free-tier.md` for setup and data-use limits.
