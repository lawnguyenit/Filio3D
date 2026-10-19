# Zero-cash AI options (reviewed 2026-10-19)

## Recommendation

The user selected **Gemini API Free Tier** for the first integration. This is zero cash only while using an eligible Free Tier project that is not linked to paid billing; quotas are finite and Google says free-tier prompts/responses may be used to improve products. The local app pins one model and stops on quota errors. Do not attach billing to continue.

ChatGPT plan-usage is not implemented. Gemini is the active adapter and must remain isolated from any paid project. The API Free Tier is distinct from a general promise that Google AI Pro can be used as an arbitrary app API.

## Provider comparison

| Route | Cost control | Access and limits | Data / integration considerations |
|---|---|---|---|
| ChatGPT plan usage via Sign in with ChatGPT | Uses eligible included plan allowance, no API key. ChatGPT says usage can fall back to credits only if the user explicitly allows it; app-level usage limits below 100% prevent credit use for that app. Disable credit fallback and automatic credit purchases, set an app cap, and fail closed at quota. | Official open-source/local-app flow is available to eligible Plus/Pro users. Plus usage is shared across ChatGPT and connected apps and has a five-hour rolling usage limit; a connected app gets no separate pool. | User authorizes plan usage; the app does not receive ChatGPT conversation history. OAuth/refresh credentials must live in a local Node process with OS-backed encryption, never in the Edge extension's browser storage. Requires a local credential broker behind the extension UI. |
| Gemini Developer API Free Tier | Certain models have zero input/output token price under a separate API Free Tier. Keep the Google project unlinked to paid billing and stop at quota; do not attach a paid key. | Limits are finite, model-specific, account/project-specific and may change. The API documentation says paid billing is required for higher tiers. | Google's current pricing table says free-tier content may be used to improve products. The API Free Tier is distinct from a general promise that Google AI Pro can be used as an arbitrary app API. |
| ChatGPT/Gemini web UI manual packet | No app-side model/API charge. | User manually opens their subscribed chat product and pastes a reviewed evidence packet; subject to that product's own limits. | Simplest fallback, but not an in-app automatic synthesis. Explicit packet preview remains useful for user control and provider changes. |

## What not to rely on

- ChatGPT Plus alone historically did not include API usage, and standard OpenAI API billing is separate. The newer open-source Sign in with ChatGPT plan-usage integration is the documented exception for eligible locally run open-source apps.
- Do not put a ChatGPT OAuth refresh token or a paid/free API key in `localStorage`, an extension bundle, or a browser renderer. The current Edge extension has only a `sidePanel` permission and should remain a UI/capture surface. A local Node credential broker with OS-backed encryption is required for the OpenAI path.
- Do not use browser automation against signed-in ChatGPT/Gemini web sessions as a substitute API. The documented OAuth or API product is the integration boundary.
- Do not promise that any free API or subscription quota is unlimited or permanently available.

## Proposed request contract

1. User selects the source set and sees the exact evidence packet before sending.
2. User selects a provider explicitly; no automatic paid fallback or cross-provider failover.
3. The app labels provider, account, and whether the request consumes plan allowance or free API quota.
4. The user confirms send. Only the selected packet, question, and instructions are transmitted; the app does not scrape ChatGPT history.
5. On quota/auth/network errors, retain the packet and draft, report the provider error, and offer copy/export or retry after the quota window. Never switch to a paid route.
6. Save synthesis output and provenance only after the user accepts it; separate model suggestions from verified evidence and personal interpretation.

## Primary sources

- OpenAI: [Sign in with ChatGPT for open-source/local apps](https://developers.openai.com/siwc/token-sharing-open-source), [quickstart](https://developers.openai.com/siwc/quickstart), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [account sessions and plan limits](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [ChatGPT app credits and usage controls](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites), and [separate API billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).
- OpenAI: [local DevKit architecture and secure credential-storage boundary](https://github.com/openai/sign-in-with-chatgpt-devkit) and [security notes](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/docs/security.md).
- Google: [Gemini API pricing and Free Tier data-use note](https://ai.google.dev/gemini-api/docs/pricing) and [Gemini API billing and tier behavior](https://ai.google.dev/gemini-api/docs/billing).
- Google Gemini CLI's [official transition announcement](https://github.com/google-gemini/gemini-cli/discussions/28017) states that on June 18, 2026 it stopped serving Google AI Pro, Google AI Ultra, and individual free-tier accounts while transitioning to Antigravity CLI. This makes the old Gemini CLI route unsuitable as a stable bridge for a custom research app.
