/**
 * @file functions/api/workspace.js
 * @description Cloudflare Pages Function lưu trữ & đồng bộ Không gian Đồ thị 3D tách biệt theo từng người dùng (`userId`).
 * Sử dụng Cloudflare KV (binding: `FILIO_KV`) — Gói Free hỗ trợ 100.000 lượt đọc/ngày.
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || 'default';

  if (!env.FILIO_KV) {
    return Response.json({ workspace: null, mode: 'local-only' });
  }

  const raw = await env.FILIO_KV.get(`workspace::${userId}`, 'json');
  return Response.json({ userId, workspace: raw || null });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.FILIO_KV) {
    return Response.json({ ok: true, mode: 'local-only' });
  }

  const body = await request.json();
  const userId = body.userId || 'default';
  if (!body.workspace || !Array.isArray(body.workspace.sources)) {
    return Response.json({ error: 'Invalid workspace payload' }, { status: 400 });
  }

  await env.FILIO_KV.put(`workspace::${userId}`, JSON.stringify(body.workspace));
  return Response.json({ ok: true, userId, savedAt: Date.now() });
}
