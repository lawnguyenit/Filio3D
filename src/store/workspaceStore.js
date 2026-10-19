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
 * Xóa sạch toàn bộ đồ thị để người dùng bắt đầu không gian nghiên cứu mới từ đầu (Canvas trống)
 */
export function clearWorkspaceState() {
  state = {
    ecosystems: [
      { id: 'eco-custom-1', title: 'Phả hệ Nghiên cứu Mới', color: '#6366f1', description: 'Phả hệ nghiên cứu tùy chỉnh của bạn' },
    ],
    sources: [],
    relations: [],
    problems: [],
    reasoningChains: [],
  };
  saveState();
  return state;
}

/**
 * Xóa một bài báo khỏi kho dữ liệu và tự động gỡ bỏ mọi mũi tên liên kết liên quan
 */
export function deletePaper(paperId) {
  if (!paperId) return false;
  state.sources = state.sources.filter((s) => s.id !== paperId);
  state.relations = state.relations.filter((r) => r.from !== paperId && r.to !== paperId);
  saveState();
  return true;
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
 * ============================================================================
 * QUẢN LÝ KÉT KHÓA API KEY CÁ NHÂN (MULTI-KEY BYOK VAULT)
 * - Cho phép lưu trữ nhiều API Key (nhiều Key Gemini, OpenAI, Claude).
 * - Tách biệt hoàn toàn theo userId cá nhân.
 * - Hỗ trợ đầy đủ Thêm / Sửa / Xóa / Kích hoạt Key đang dùng.
 * ============================================================================
 */
const VAULT_STORAGE_KEY = `${USER_API_KEYS_STORAGE}::vault::`;
const ACTIVE_KEY_STORAGE_KEY = `${USER_API_KEYS_STORAGE}::activeId::`;

export function getUserApiKeys() {
  try {
    const raw = localStorage.getItem(`${VAULT_STORAGE_KEY}${currentUserId}`);
    let list = [];
    if (raw) {
      list = JSON.parse(raw);
    }
    if (!Array.isArray(list)) list = [];

    // Tự động di chuyển (migrate) từ kho single-key cũ nếu có
    const oldRaw = localStorage.getItem(`${USER_API_KEYS_STORAGE}::${currentUserId}`);
    if (oldRaw && list.length === 0) {
      try {
        const oldMap = JSON.parse(oldRaw);
        if (oldMap && typeof oldMap === 'object') {
          Object.entries(oldMap).forEach(([prov, key]) => {
            if (key && typeof key === 'string' && key.trim()) {
              list.push({
                id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name:
                  prov === 'gemini-api'
                    ? 'Google Gemini (Mặc định)'
                    : prov === 'openai-api'
                    ? 'OpenAI GPT'
                    : 'Anthropic Claude',
                provider: prov,
                model:
                  prov === 'gemini-api'
                    ? 'gemini-3.8-flash'
                    : prov === 'openai-api'
                    ? 'gpt-4o-mini'
                    : 'claude-3-5-sonnet',
                apiKey: key.trim(),
                createdAt: new Date().toISOString(),
              });
            }
          });
          if (list.length > 0) {
            localStorage.setItem(`${VAULT_STORAGE_KEY}${currentUserId}`, JSON.stringify(list));
            localStorage.setItem(`${ACTIVE_KEY_STORAGE_KEY}${currentUserId}`, list[0].id);
          }
        }
      } catch (e) {}
    }

    return list;
  } catch (e) {
    return [];
  }
}

export function saveUserApiKey(record) {
  try {
    const list = getUserApiKeys();
    let savedItem = null;
    if (record.id) {
      const idx = list.findIndex((k) => k.id === record.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name: record.name?.trim() || list[idx].name,
          provider: record.provider || list[idx].provider,
          model: record.model?.trim() || list[idx].model,
          apiKey: record.apiKey?.trim() || list[idx].apiKey,
          updatedAt: new Date().toISOString(),
        };
        savedItem = list[idx];
      }
    }
    if (!savedItem) {
      savedItem = {
        id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: record.name?.trim() || 'API Key Mới',
        provider: record.provider || 'gemini-api',
        model: record.model?.trim() || 'gemini-3.8-flash',
        apiKey: (record.apiKey || '').trim(),
        createdAt: new Date().toISOString(),
      };
      list.push(savedItem);
    }
    localStorage.setItem(`${VAULT_STORAGE_KEY}${currentUserId}`, JSON.stringify(list));

    const activeId = getActiveApiKeyId();
    if (!activeId || record.makeActive || list.length === 1) {
      setActiveApiKeyId(savedItem.id);
    }
    return savedItem;
  } catch (e) {
    return null;
  }
}

export function deleteUserApiKey(id) {
  try {
    let list = getUserApiKeys();
    list = list.filter((k) => k.id !== id);
    localStorage.setItem(`${VAULT_STORAGE_KEY}${currentUserId}`, JSON.stringify(list));
    const activeId = getActiveApiKeyId();
    if (activeId === id) {
      setActiveApiKeyId(list.length > 0 ? list[0].id : '');
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function getActiveApiKeyId() {
  try {
    const activeId = localStorage.getItem(`${ACTIVE_KEY_STORAGE_KEY}${currentUserId}`) || '';
    const list = getUserApiKeys();
    if (activeId && list.some((k) => k.id === activeId)) {
      return activeId;
    }
    if (list.length > 0) {
      localStorage.setItem(`${ACTIVE_KEY_STORAGE_KEY}${currentUserId}`, list[0].id);
      return list[0].id;
    }
    return '';
  } catch (e) {
    return '';
  }
}

export function setActiveApiKeyId(id) {
  try {
    localStorage.setItem(`${ACTIVE_KEY_STORAGE_KEY}${currentUserId}`, id || '');
  } catch (e) {}
}

export function getActiveApiKeyRecord() {
  const activeId = getActiveApiKeyId();
  if (!activeId) return null;
  const list = getUserApiKeys();
  return list.find((k) => k.id === activeId) || null;
}

export function hasAnyApiKey() {
  return getUserApiKeys().length > 0;
}

/**
 * Tương thích ngược: Lấy key theo provider
 */
export function getUserPersonalApiKey(provider) {
  const active = getActiveApiKeyRecord();
  if (active && active.provider === provider) {
    return active.apiKey || '';
  }
  const all = getUserApiKeys();
  const matched = all.find((k) => k.provider === provider);
  return matched?.apiKey || '';
}

export function saveUserPersonalApiKey(provider, apiKey) {
  const all = getUserApiKeys();
  const existing = all.find((k) => k.provider === provider);
  if (existing) {
    saveUserApiKey({ id: existing.id, apiKey });
  } else {
    saveUserApiKey({
      name: provider === 'gemini-api' ? 'Google Gemini' : provider === 'openai-api' ? 'OpenAI GPT' : 'Anthropic Claude',
      provider,
      model: provider === 'gemini-api' ? 'gemini-3.8-flash' : provider === 'openai-api' ? 'gpt-4o-mini' : 'claude-3-5-sonnet',
      apiKey,
      makeActive: true,
    });
  }
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
