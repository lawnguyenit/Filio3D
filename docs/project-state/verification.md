# Verification and acceptance

## Checks completed

- `node --check app.js` completed with exit code 0 (JavaScript syntax check only).
- Manifest and service worker are present for a Manifest V3 Edge sidebar; they have not yet been loaded in Edge.
- Confirmed the prototype consists of local static files and has no build/install step.
- No automated tests were added or run.
- Gemini integration syntax and manifest checks remain to be completed. No key was available, so a live request to Google cannot be verified during development.

## Not verified yet

- Rendered appearance and responsive layout in Edge, including the narrow sidebar width and actual side-panel behavior.
- Actual pointer/keyboard interactions in a browser, local-storage persistence across reloads, import/export round-trip, and storage-full recovery.
- Accessibility with keyboard-only navigation or screen readers.
- 3D graph usability with a real large citation network. The current graph is small illustrative data, not a discovered citation graph.
- Correctness of sample paper metadata and citations; treat all example bibliography and counts as illustrative until replaced with verified sources.
- Voice capture, rendered Edge side-panel behavior, live Gemini API response/quota behavior, external citation metadata, and synchronization.

## User acceptance needed

- Whether the four relation line patterns/colors and graph layout convey the intended meaning.
- Whether the 3D focus map is useful enough to retain alongside list/detail navigation.
- Whether Gemini synthesis behavior and the Edge sidebar belong in the first usable release.
