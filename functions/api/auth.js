/**
 * @file functions/api/auth.js
 * @description Cloudflare Pages Function xác thực & ký số Mã Truy Cập có thời hạn (HMAC-SHA256).
 * Đường dẫn tự động trên Cloudflare Pages: POST /api/auth
 */

const DEFAULT_SIGNING_PEPPER = 'Filio3D-Research-Lineage-HMAC-2026-SecretKey';
const DEFAULT_MASTER_ADMIN = 'FILIO3D-ADMIN-2026';

async function computeHmacHex(userId, expiryDateStr, role, secret) {
  const payload = `F3D|${userId}|${expiryDateStr}|${role}|${secret}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 12);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const signingSecret = env.WORKSPACE_SIGNING_SECRET || DEFAULT_SIGNING_PEPPER;
  const masterAdminKey = env.MASTER_ADMIN_SECRET || DEFAULT_MASTER_ADMIN;

  try {
    const body = await request.json();
    const token = String(body.token || '').trim();

    if (token === masterAdminKey) {
      return Response.json({
        valid: true,
        userId: 'master-admin',
        displayName: 'Chủ sở hữu (Master Admin)',
        role: 'admin',
        expiryDate: 'PERMANENT',
        token,
      });
    }

    const parts = token.split('.');
    if (parts.length !== 5 || parts[0] !== 'F3D') {
      return Response.json({
        valid: false,
        reason: 'Định dạng mã truy cập không hợp lệ.',
      });
    }

    const [, userId, expiryDateStr, role, providedSig] = parts;
    const expectedSig = await computeHmacHex(userId, expiryDateStr, role, signingSecret);

    if (providedSig.toUpperCase() !== expectedSig.toUpperCase()) {
      return Response.json({
        valid: false,
        reason: 'Chữ ký bảo mật của mã không hợp lệ hoặc đã bị giả mạo.',
      });
    }

    if (expiryDateStr !== 'PERMANENT') {
      const expTime = Date.parse(`${expiryDateStr}T23:59:59Z`);
      if (Number.isNaN(expTime) || Date.now() > expTime) {
        return Response.json({
          valid: false,
          reason: `Mã truy cập đã hết hạn vào ngày ${expiryDateStr}.`,
        });
      }
    }

    return Response.json({
      valid: true,
      userId,
      displayName: userId,
      role,
      expiryDate: expiryDateStr,
      token,
    });
  } catch (err) {
    return Response.json({ valid: false, reason: 'Lỗi xử lý xác thực.' }, { status: 400 });
  }
}
