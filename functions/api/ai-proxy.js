/**
 * @file functions/api/ai-proxy.js
 * @description Cloudflare Pages Function gọi hộ API LLM (Anthropic Claude / Gemini / OpenAI)
 * theo cơ chế BYOK (Bring Your Own Key): Bắt buộc người dùng truyền `apiKey` cá nhân của chính họ,
 * tuyệt đối không sử dụng bất kỳ API Key nào của chủ sở hữu hệ thống.
 */

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { provider, apiKey, model, prompt } = body;

    if (!apiKey || !String(apiKey).trim()) {
      return Response.json(
        {
          message:
            'Bạn phải nhập API Key cá nhân của riêng mình để sử dụng tính năng gọi AI tự động.',
        },
        { status: 400 }
      );
    }

    if (provider === 'claude-api') {
      const cleanModel = model || 'claude-3-7-sonnet-latest';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cleanModel,
          max_tokens: 3500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return Response.json(
          { message: data.error?.message || 'Anthropic API từ chối kết nối. Kiểm tra lại API Key của bạn.' },
          { status: res.status }
        );
      }
      const text = (data.content || []).map((c) => c.text || '').join('\n');
      return Response.json({ provider: `Anthropic (${cleanModel})`, text });
    }

    return Response.json({ message: 'Nhà cung cấp không hợp lệ.' }, { status: 400 });
  } catch (err) {
    return Response.json({ message: err.message || 'Lỗi kết nối AI Proxy.' }, { status: 500 });
  }
}
