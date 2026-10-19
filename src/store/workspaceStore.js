/**
 * @file src/store/workspaceStore.js
 * @description Quản lý Kho Dữ liệu Đồ thị Nghiên cứu 3D tách biệt hoàn toàn theo từng người dùng (`userId`):
 * - Mỗi Mã Truy Cập (`userId`) có một kho dữ liệu độc lập (`filio3d-v4-workspace::<userId>`).
 * - Tự động đồng bộ ngầm với đám mây Cloudflare (`/api/workspace`) theo đúng Token của người dùng đó.
 * - Quản lý khóa API AI cá nhân (BYOK - Bring Your Own Key): Người nào tự nhập API Key của người đó thì mới gọi AI tự động được, tuyệt đối không tiêu tốn API của chủ web.
 */

import { STORAGE_PREFIX, USER_API_KEYS_STORAGE } from '../config/constants.js';
import { createDefaultState } from '../data/defaultState.js';
import { getActiveSession } from '../auth/accessGate.js';
import { $, notify } from '../utils/dom.js';

let state = createDefaultState();
let currentUserId = 'guest';

function getStorageKeyForUser(userId) {
  return `${STORAGE_PREFIX}::${userId || 'default'}`;
}

/**
 * Khởi tạo dữ liệu đồ thị riêng cho người dùng vừa đăng nhập.
 * Ưu tiên tải bản lưu trên Cloud (nếu có kết nối Cloudflare KV/D1), sau đó tới LocalStorage của userId đó.
 */
export async function initWorkspaceForUser(session) {
  currentUserId = session?.userId || 'default';
  const localKey = getStorageKeyForUser(currentUserId);

  // 1. Tải từ LocalStorage của đúng userId này
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sources)) {
        state = parsed;
      }
    } else {
      state = structuredClone(createDefaultState());
      localStorage.setItem(localKey, JSON.stringify(state));
    }
  } catch (e) {
    state = structuredClone(createDefaultState());
  }

  // 2. Thử đồng bộ bản mới nhất từ Cloudflare Worker (/api/workspace) nếu đã deploy lên Cloud
  if (session?.token) {
    try {
      const res = await fetch(`/api/workspace?userId=${encodeURIComponent(currentUserId)}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData?.workspace && Array.isArray(cloudData.workspace.sources)) {
          state = cloudData.workspace;
          localStorage.setItem(localKey, JSON.stringify(state));
        }
      }
    } catch (e) {
      // Đang chạy ở chế độ Local hoặc tĩnh chưa gắn KV -> Dùng LocalStorage cô lập theo userId
    }
  }

  updateSidebarStorageStats();
  return state;
}

export function getState() {
  return state;
}

export function setState(nextState) {
  state = nextState;
  saveState();
}

export function resetToDefaultWorkspace() {
  state = structuredClone(createDefaultState());
  saveState();
  return state;
}

/**
 * Lưu trạng thái đồ thị vào đúng phân vùng riêng của userId hiện tại (Local + Cloud)
 */
export function saveState() {
  const localKey = getStorageKeyForUser(currentUserId);
  try {
    localStorage.setItem(localKey, JSON.stringify(state));
    updateSidebarStorageStats();
  } catch (e) {
    notify('Bộ nhớ trình duyệt đầy. Hãy xuất file JSON lưu vào Google Drive.');
    return false;
  }

  // Đồng bộ ngầm lên Cloudflare KV (nếu đang chạy trên Cloudflare Pages Functions)
  const session = getActiveSession();
  if (session?.token) {
    fetch('/api/workspace', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        userId: currentUserId,
        workspace: state,
        updatedAt: Date.now(),
      }),
    }).catch(() => {});
  }

  return true;
}

export function updateSidebarStorageStats() {
  const statsEl = $('#storageStatsText');
  if (statsEl) {
    statsEl.textContent = `${state.sources.length} bài · ${state.relations.length} cạnh · ${state.ecosystems.length} phả hệ`;
  }
  const navPaperEl = $('#navPaperCount');
  if (navPaperEl) {
    navPaperEl.textContent = state.sources.length;
  }
}

/**
 * Quản lý API Key cá nhân (BYOK - Ai có Key người đó dùng)
 */
export function getUserPersonalApiKey(provider) {
  try {
    const raw = localStorage.getItem(`${USER_API_KEYS_STORAGE}::${currentUserId}`);
    if (!raw) return '';
    const map = JSON.parse(raw);
    return map[provider] || '';
  } catch (e) {
    return '';
  }
}

export function saveUserPersonalApiKey(provider, apiKey) {
  try {
    const storageKey = `${USER_API_KEYS_STORAGE}::${currentUserId}`;
    const raw = localStorage.getItem(storageKey);
    const map = raw ? JSON.parse(raw) : {};
    map[provider] = (apiKey || '').trim();
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch (e) {}
}

/**
 * Xuất / Nhập file JSON cá nhân (Dễ dàng lưu trữ lên Google Drive 5TB của người dùng)
 */
export function exportWorkspaceJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `filio3d-${currentUserId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
