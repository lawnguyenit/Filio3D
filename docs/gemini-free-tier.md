# Gemini Free Tier setup

This app uses Google Gemini Developer API Free Tier through a local Node.js bridge. The Edge extension never stores or receives the API key. The bridge accepts requests only from this extension ID, binds to `127.0.0.1`, pins `gemini-3.8-flash`, sends `store:false`, and has no paid fallback.

## Set up a no-billing key

1. In Google AI Studio, create a Gemini API key and keep its project on the **Free Tier**. Confirm the project is not linked to Cloud Billing. Google describes adding billing as the step to upgrade to paid tier; the app cannot determine a key's billing tier by inspecting it.
2. Do not paste the key into the app, source files, browser storage, or chat. Keep it private.
3. In PowerShell, open this app folder and run:

   ```powershell
   .\Start-Gemini.ps1
   ```

   If PowerShell blocks this local script, use a one-time process setting: `powershell -ExecutionPolicy Bypass -File .\Start-Gemini.ps1`. The script prompts for the key without displaying it, keeps it only in the running process environment, then clears that variable when stopped. Press Ctrl+C to stop the bridge.

4. Load or reload the unpacked extension from `edge://extensions`. Open its side panel and use **Tái tổng hợp**. The bridge status should say it is ready.
5. Choose the exact papers, optionally enter a synthesis goal, then choose **Xem trước gói bằng chứng**. Inspect the displayed packet. **Gửi tới Gemini** asks again before any research text leaves this device.
6. Results remain unsaved until you choose **Lưu kết quả thành ghi chú**. Quota (429), authorization, connectivity, and server errors retain the preview and never switch to a paid route.

## Data and cost limits

Google's current Gemini pricing page lists Free Tier access for some models and says free-tier prompts/responses may be used to improve Google's products. Do not send confidential or sensitive research data unless comfortable with that policy. `store:false` requests stateless interaction handling; it does not override Google's Free Tier data-use terms.

Free quotas are finite and can change. The app does not inspect your Google project, billing attachment, available quota, or remaining credits. A key associated with a paid project could incur charges under Google's billing setup, so the $0 condition depends on keeping the selected project unlinked to billing. If you see a quota response, stop and wait for quota reset; do not attach billing to make this app continue.

The local bridge is intended for a single-user local machine. Its fixed extension origin and loopback binding reduce exposure, but local software running as your Windows account is within the same device trust boundary. Stop the bridge when you are done.

## Current implementation limits

- Text synthesis only; no PDF/document upload, citation search, voice, or automatic page capture.
- The user-selected packet contains source metadata and personal interpretations stored in the app. Check it before sending.
- Google may change model names, endpoint behavior, free quotas, or data policies. On incompatibility the bridge reports an error and does not switch models/providers automatically.
- No live API call was made during development because no user API key was provided.

## Official Google documentation checked 2026-10-19

- [Gemini API quickstart / REST Interactions API](https://ai.google.dev/gemini-api/docs/get-started?lang=rest)
- [Gemini API key security](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini API pricing and Free Tier](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
