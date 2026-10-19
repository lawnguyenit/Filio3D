/**
 * @file src/config/constants.js
 * @description Định nghĩa toàn bộ hằng số cấu hình của ứng dụng Filio3D:
 * - ARROW_TYPES: 8 loại mũi tên ngữ nghĩa trong không gian 3D (Kế thừa, Tấn công, Tương khắc, Hỗ trợ, Điều kiện, Giải quyết, Suy luận, Khe hở).
 * - CONDITION_CATEGORIES: 4 nhóm điều kiện biên của bài báo.
 * - CLOUD_LLM_PROVIDERS: Các nhà cung cấp AI Cloud theo cơ chế BYOK (Người dùng tự nhập API Key của riêng mình).
 */

export const STORAGE_PREFIX = 'filio3d-v4-workspace';
export const SESSION_AUTH_KEY = 'filio3d-v4-auth-session';
export const USER_API_KEYS_STORAGE = 'filio3d-v4-user-llm-keys';

export const ARROW_TYPES = {
  lineage: {
    label: 'Kế thừa / Phả hệ',
    short: '🧬 Kế thừa',
    color: '#818cf8',
    lightColor: '#4f46e5',
    dash: [],
    particles: true,
    particleSpeed: 0.0045,
    curveHeight: 0.35,
  },
  refute: {
    label: 'Tấn công / Bác bỏ',
    short: '✕ Tấn công / Bác bỏ',
    color: '#ef4444',
    lightColor: '#dc2626',
    dash: [8, 4],
    particles: true,
    particleSpeed: 0.0075,
    curveHeight: -0.45,
  },
  conflict: {
    label: 'Tương khắc / Mâu thuẫn',
    short: '⚡ Tương khắc',
    color: '#f59e0b',
    lightColor: '#d97706',
    dash: [6, 4],
    particles: false,
    bidirectional: true,
    curveHeight: 0.48,
  },
  support: {
    label: 'Hỗ trợ / Củng cố',
    short: '↗ Hỗ trợ',
    color: '#10b981',
    lightColor: '#059669',
    dash: [],
    particles: true,
    particleSpeed: 0.005,
    curveHeight: 0.22,
  },
  condition: {
    label: 'Ràng buộc Điều kiện',
    short: '⌑ Điều kiện',
    color: '#eab308',
    lightColor: '#ca8a04',
    dash: [3, 4],
    particles: false,
    curveHeight: 0.2,
  },
  solves: {
    label: 'Giải quyết Vấn đề',
    short: '◈ Giải quyết',
    color: '#38bdf8',
    lightColor: '#0284c7',
    dash: [2, 4],
    particles: false,
    curveHeight: 0.15,
  },
  reasoning: {
    label: 'Chuỗi suy luận',
    short: '➔ Suy luận',
    color: '#60a5fa',
    lightColor: '#2563eb',
    dash: [],
    particles: true,
    particleSpeed: 0.006,
    curveHeight: 0.18,
  },
  gap: {
    label: 'Khe hở Nghiên cứu',
    short: '◇ Khe hở',
    color: '#ec4899',
    lightColor: '#db2777',
    dash: [4, 4],
    particles: true,
    particleSpeed: 0.005,
    curveHeight: 0.28,
  },
};

export const CONDITION_CATEGORIES = {
  data: 'Dữ liệu & Mẫu',
  environment: 'Môi trường / Miền',
  method: 'Giả định Mô hình',
  metric: 'Thước đo Đánh giá',
};

export const CLOUD_LLM_PROVIDERS = {
  'gemini-api': {
    label: '✨ Google AI Studio — Gemini API (Key cá nhân)',
    defaultModel: 'gemini-3.8-flash',
    keyPlaceholder: 'Dán Gemini API Key của bạn (AIzaSy...)',
    hint: 'Gọi trực tiếp Gemini bằng API Key cá nhân của bạn. Key chỉ lưu trên trình duyệt của bạn, không dùng chung với người khác.',
  },
  'openai-api': {
    label: '🧠 OpenAI — ChatGPT / GPT-4o API (Key cá nhân)',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'Dán OpenAI API Key của bạn (sk-...)',
    hint: 'Gọi trực tiếp OpenAI GPT-4o / GPT-4o-mini bằng API Key của riêng bạn.',
  },
  'claude-api': {
    label: '🤖 Anthropic — Claude API (Key cá nhân)',
    defaultModel: 'claude-3-7-sonnet-latest',
    keyPlaceholder: 'Dán Anthropic API Key của bạn (sk-ant-...)',
    hint: 'Gọi trực tiếp Anthropic Claude bằng API Key cá nhân của bạn.',
  },
  'manual-paste': {
    label: '📋 Không có API Key — Chỉ tạo Prompt chuẩn & Dán thủ công vào Bộ Trung Gian',
    defaultModel: '',
    keyPlaceholder: '',
    hint: 'Dành cho người dùng không có API Key: Bạn vẫn có thể chép lệnh Prompt chuẩn để hỏi trên web ChatGPT/Claude/Gemini của bạn rồi dán câu trả lời vào Bộ Trung Gian bên phải.',
  },
};
