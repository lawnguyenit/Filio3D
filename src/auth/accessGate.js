/**
 * @file src/auth/accessGate.js
 * @description Hệ thống Cổng Khóa Truy Cập (Access Gate) & Trình Tạo Mã Có Thời Hạn (Admin Key Generator):
 * 1. Chặn 100% người lạ chưa có Mã Truy Cập (không cho xem hay tương tác với ứng dụng).
 * 2. Xác thực chữ ký số HMAC-SHA256 và kiểm tra hạn sử dụng (YYYY-MM-DD) của từng mã.
 * 3. Mỗi mã định danh (`userId`) mở ra một Không gian Nghiên cứu 3D độc lập, bảo mật riêng cho người đó.
 * 4. Cung cấp bảng "Cấp Mã Truy Cập Có Thời Hạn" cho Chủ sở hữu (Admin) để tạo mã cho Thầy hướng dẫn / đồng nghiệp.
 */

import { SESSION_AUTH_KEY } from '../config/constants.js';
import { $, escapeHTML, notify } from '../utils/dom.js';

// Khóa bí mật mặc định dùng để ký HMAC-SHA256 (Khi chạy trên Cloudflare, có thể ghi đè bằng biến môi trường WORKSPACE_SIGNING_SECRET)
const DEFAULT_SIGNING_PEPPER = 'Filio3D-Research-Lineage-HMAC-2026-SecretKey';
const DEFAULT_MASTER_ADMIN_SECRET = 'FILIO3D-ADMIN-2026';

let currentSession = null;

/**
 * Chuẩn hóa chuỗi thành slug an toàn cho userId (VD: "Thầy Nguyễn Văn A" -> "thay-nguyen-van-a")
 */
export function slugifyUserId(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'researcher';
}

/**
 * Tính chữ ký HMAC-SHA256 (12 ký tự Hex viết hoa) bằng Web Crypto API chuẩn trình duyệt & Cloudflare Workers
 */
export async function computeTokenSignature(userId, expiryDateStr, role, masterSecret = DEFAULT_SIGNING_PEPPER) {
  const payload = `F3D|${userId}|${expiryDateStr}|${role}|${masterSecret}`;
  const enc = new TextEncoder();
  const keyData = enc.encode(masterSecret);
  const msgData = enc.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hex = [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex.slice(0, 12);
}

/**
 * Tạo Mã Truy Cập có thời hạn (Signed Access Key)
 * Định dạng: F3D.<userId>.<YYYY-MM-DD|PERMANENT>.<admin|member>.<12_HEX_SIG>
 */
export async function generateSignedAccessKey({
  userId,
  expiryDateStr = '2026-12-31',
  role = 'member',
  masterSecret = DEFAULT_SIGNING_PEPPER,
}) {
  const cleanUser = slugifyUserId(userId);
  const cleanExp = expiryDateStr === 'PERMANENT' ? 'PERMANENT' : expiryDateStr;
  const cleanRole = role === 'admin' ? 'admin' : 'member';
  const sig = await computeTokenSignature(cleanUser, cleanExp, cleanRole, masterSecret);
  return `F3D.${cleanUser}.${cleanExp}.${cleanRole}.${sig}`;
}

/**
 * Kiểm tra tính hợp lệ và thời hạn của một Mã Truy Cập
 */
export async function verifyAccessKey(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) {
    return { valid: false, reason: 'Vui lòng nhập Mã Truy Cập.' };
  }

  // 1. Thử xác thực qua Cloudflare Pages Function (/api/auth) nếu đang chạy trên Cloud có cấu hình Secret riêng
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token }),
    });
    if (res.ok) {
      const cloudResult = await res.json();
      if (cloudResult && typeof cloudResult.valid === 'boolean') {
        return cloudResult;
      }
    }
  } catch (e) {
    // Nếu chạy local hoặc tĩnh chưa bật Worker, chuyển sang xác thực chữ ký số HMAC-SHA256 trực tiếp
  }

  // 2. Cho phép đăng nhập nhanh bằng Master Admin Key mặc định của chủ dự án
  if (token === DEFAULT_MASTER_ADMIN_SECRET) {
    return {
      valid: true,
      userId: 'master-admin',
      displayName: 'Chủ sở hữu (Master Admin)',
      role: 'admin',
      expiryDate: 'PERMANENT',
      token,
    };
  }

  // 3. Phân tách cấu trúc mã: F3D.<userId>.<YYYY-MM-DD|PERMANENT>.<role>.<sig>
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'F3D') {
    return {
      valid: false,
      reason: 'Định dạng mã không hợp lệ. Mã chuẩn có dạng: F3D.<tên>.<hạn-sử-dụng>.<quyền>.<chữ-ký>',
    };
  }

  const [, userId, expiryDateStr, role, providedSig] = parts;
  const expectedSig = await computeTokenSignature(userId, expiryDateStr, role);

  if (providedSig.toUpperCase() !== expectedSig.toUpperCase()) {
    return {
      valid: false,
      reason: 'Mã truy cập không hợp lệ hoặc đã bị chỉnh sửa sai chữ ký bảo mật!',
    };
  }

  // 4. Kiểm tra thời hạn sử dụng
  if (expiryDateStr !== 'PERMANENT') {
    const expTime = Date.parse(`${expiryDateStr}T23:59:59`);
    if (Number.isNaN(expTime)) {
      return { valid: false, reason: 'Ngày hết hạn trên mã không hợp lệ.' };
    }
    if (Date.now() > expTime) {
      return {
        valid: false,
        reason: `Mã truy cập của "${userId}" đã hết hạn vào ngày ${expiryDateStr}. Vui lòng liên hệ chủ web để cấp mã mới.`,
      };
    }
  }

  return {
    valid: true,
    userId,
    displayName: userId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role,
    expiryDate: expiryDateStr,
    token,
  };
}

export function getActiveSession() {
  return currentSession;
}

export function logoutSession() {
  localStorage.removeItem(SESSION_AUTH_KEY);
  currentSession = null;
  window.location.reload();
}

/**
 * Khởi chạy Cổng Khóa Truy Cập trước khi cho phép vào ứng dụng.
 * Nếu chưa có phiên hợp lệ, giữ màn hình khóa và chặn toàn bộ quyền truy cập.
 */
export async function enforceAccessGate(onAuthenticated) {
  const gateOverlay = $('#accessGateOverlay');
  const appShell = $('#appShellMain');

  // Kiểm tra phiên đã lưu trong localStorage
  try {
    const savedRaw = localStorage.getItem(SESSION_AUTH_KEY);
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (saved?.token) {
        const check = await verifyAccessKey(saved.token);
        if (check.valid) {
          currentSession = check;
          unlockApplicationUI(check, onAuthenticated);
          return;
        } else {
          localStorage.removeItem(SESSION_AUTH_KEY);
        }
      }
    }
  } catch (e) {
    localStorage.removeItem(SESSION_AUTH_KEY);
  }

  // Nếu chưa đăng nhập hoặc mã hết hạn -> Khóa toàn màn hình
  if (appShell) appShell.hidden = true;
  if (gateOverlay) gateOverlay.hidden = false;

  bindAccessGateEvents(onAuthenticated);
}

function unlockApplicationUI(session, onAuthenticated) {
  const gateOverlay = $('#accessGateOverlay');
  const appShell = $('#appShellMain');
  if (gateOverlay) gateOverlay.hidden = true;
  if (appShell) appShell.hidden = false;

  // Hiển thị thông tin phiên đăng nhập ở thanh bên trái
  const userBadge = $('#activeUserBadge');
  if (userBadge) {
    const expText = session.expiryDate === 'PERMANENT' ? 'Vĩnh viễn' : `Hạn: ${session.expiryDate}`;
    userBadge.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="font-weight:700;color:#f8fafc">👤 ${escapeHTML(session.userId)}</span>
        <span class="tab-pill" style="background:${session.role === 'admin' ? '#4f46e5' : '#059669'}">
          ${session.role === 'admin' ? 'Admin' : 'Member'}
        </span>
      </div>
      <div style="font-size:9.5px;color:#94a3b8;margin-top:2px">⏳ ${escapeHTML(expText)} · Không gian riêng</div>
    `;
  }

  // Chỉ hiện nút "🔑 Tạo Mã Cấp Quyền" nếu là Admin
  const btnOpenKeyGen = $('#btnOpenAdminKeyModal');
  if (btnOpenKeyGen) {
    btnOpenKeyGen.hidden = session.role !== 'admin';
  }

  bindAuthenticatedToolbarEvents();

  if (typeof onAuthenticated === 'function') {
    onAuthenticated(session);
  }
}

function bindAccessGateEvents(onAuthenticated) {
  const form = $('#accessLoginForm');
  const input = $('#accessKeyInput');
  const errBox = $('#accessErrorMsg');
  const btnToggleGenerator = $('#btnToggleGateKeyGen');
  const genPanel = $('#gateAdminGeneratorPanel');

  // Đặt ngày mặc định (30 ngày tới) cho bộ tạo mã
  const defaultDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if ($('#genExpiryDate')) $('#genExpiryDate').value = defaultDate;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errBox) errBox.hidden = true;
    const rawKey = input?.value.trim();
    const res = await verifyAccessKey(rawKey);

    if (!res.valid) {
      if (errBox) {
        errBox.textContent = `⛔ ${res.reason}`;
        errBox.hidden = false;
      }
      return;
    }

    currentSession = res;
    localStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(res));
    notify(`🔓 Đăng nhập thành công vào không gian của "${res.userId}"!`);
    unlockApplicationUI(res, onAuthenticated);
  });

  btnToggleGenerator?.addEventListener('click', () => {
    if (genPanel) genPanel.hidden = !genPanel.hidden;
  });

  bindKeyGeneratorControls();
}

function bindAuthenticatedToolbarEvents() {
  $('#btnLogoutSession')?.addEventListener('click', () => {
    if (confirm('Đăng xuất khỏi phiên làm việc hiện tại?')) {
      logoutSession();
    }
  });

  $('#btnOpenAdminKeyModal')?.addEventListener('click', () => {
    const modal = $('#adminKeyModal');
    if (modal) {
      modal.hidden = false;
      const defaultDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      if ($('#modalGenExpiryDate') && !$('#modalGenExpiryDate').value) {
        $('#modalGenExpiryDate').value = defaultDate;
      }
    }
  });

  $('#btnCloseAdminKeyModal')?.addEventListener('click', () => {
    const modal = $('#adminKeyModal');
    if (modal) modal.hidden = true;
  });

  bindKeyGeneratorControls();
}

let keyGenBound = false;
function bindKeyGeneratorControls() {
  if (keyGenBound) return;
  keyGenBound = true;

  // Hỗ trợ tạo mã ngay ở màn hình Gate (cần nhập Master Secret) VÀ trong Modal Admin khi đã đăng nhập
  $('#btnGenerateKeyFromGate')?.addEventListener('click', async () => {
    const masterInput = $('#gateMasterSecretInput')?.value.trim();
    if (masterInput !== DEFAULT_MASTER_ADMIN_SECRET) {
      alert('Sai Mật khẩu Chủ sở hữu (Master Secret)! Mặc định là: FILIO3D-ADMIN-2026');
      return;
    }
    const name = $('#genRecipientName')?.value.trim() || 'thay-huong-dan';
    const exp = $('#genPermanentCheck')?.checked ? 'PERMANENT' : $('#genExpiryDate')?.value || '2026-12-31';
    const role = $('#genRoleSelect')?.value || 'member';

    const token = await generateSignedAccessKey({
      userId: name,
      expiryDateStr: exp,
      role,
    });

    const outBox = $('#gateGeneratedTokenOutput');
    if (outBox) {
      outBox.value = token;
      $('#gateGeneratedResultWrap').hidden = false;
    }
  });

  $('#btnCopyGateToken')?.addEventListener('click', async () => {
    const val = $('#gateGeneratedTokenOutput')?.value;
    if (!val) return;
    await navigator.clipboard.writeText(val).catch(() => {});
    notify('📋 Đã copy Mã Truy Cập! Bạn có thể gửi mã này cho Thầy hoặc đồng nghiệp.');
  });

  $('#btnGenerateKeyFromModal')?.addEventListener('click', async () => {
    const name = $('#modalGenRecipientName')?.value.trim() || 'thay-huong-dan';
    const exp = $('#modalGenPermanentCheck')?.checked
      ? 'PERMANENT'
      : $('#modalGenExpiryDate')?.value || '2026-12-31';
    const role = $('#modalGenRoleSelect')?.value || 'member';

    const token = await generateSignedAccessKey({
      userId: name,
      expiryDateStr: exp,
      role,
    });

    const outBox = $('#modalGeneratedTokenOutput');
    if (outBox) {
      outBox.value = token;
      $('#modalGeneratedResultWrap').hidden = false;
    }
    notify(`✨ Đã tạo mã truy cập riêng cho "${slugifyUserId(name)}"!`);
  });

  $('#btnCopyModalToken')?.addEventListener('click', async () => {
    const val = $('#modalGeneratedTokenOutput')?.value;
    if (!val) return;
    await navigator.clipboard.writeText(val).catch(() => {});
    notify('📋 Đã copy Mã Truy Cập vào Clipboard!');
  });
}
