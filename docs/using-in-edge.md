# Load the local Edge sidebar prototype

1. In Microsoft Edge, open `edge://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `Research_Notes_App` folder.
4. Pin **Folio Research Notebook** from the Extensions menu.
5. Open any page (for example ChatGPT) and click the Folio extension icon. Its panel should stay beside the current page while you work.

The current prototype asks the user to type or paste the captured idea. It requests the `sidePanel` permission plus a loopback host permission for the Gemini bridge. It does not read the current page, selected text, ChatGPT conversation, or browser history. Browser storage belongs to this extension installation; export a JSON backup before removing the extension or clearing extension data.

For Gemini synthesis, start the local bridge with `Start-Gemini.ps1` and follow [`gemini-free-tier.md`](gemini-free-tier.md). The extension adds a loopback host permission for that bridge. It still does not read ChatGPT or the active page.
