/**
 * @file src/views/aiHubView.js
 * @description Quản lý Tab 3 ("AI & Bộ Trung Gian") theo cơ chế Cloud Multi-Key BYOK:
 * - Người dùng quản lý nhiều API Key trong Két Khóa cá nhân (Gemini / OpenAI / Claude).
 * - Luồng làm việc 3 bước sạch sẽ, vừa vặn 1 màn hình (100vh), KHÔNG CUỘN, KHÔNG TRÀN CHỮ.
 * - Form nổi (Floating Modals) cho: Quản lý Keys, Xem/Sửa Super Prompt, và Xem Bóc Tách 7 Trụ Cột.
 */

import { ARROW_TYPES, CLOUD_LLM_PROVIDERS } from '../config/constants.js';
import {
  getState,
  saveState,
  getUserApiKeys,
  saveUserApiKey,
  deleteUserApiKey,
  getActiveApiKeyId,
  setActiveApiKeyId,
  getActiveApiKeyRecord,
  hasAnyApiKey,
  getUserPersonalApiKey,
  saveUserPersonalApiKey,
} from '../store/workspaceStore.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { renderSidebarLineages, renderFloatingInspector } from './inspectorView.js';
import { $, $$, escapeHTML, notify } from '../utils/dom.js';

let selectedAiMode = 'decompose'; // 'decompose' | 'attack_defense'
let currentAiStep = 1; // 1 | 2 | 3
let stagedGraphData = null;
let isGatekeeperBypassed = false;

export function setAiStep(step) {
  currentAiStep = step;
  for (let i = 1; i <= 3; i++) {
    const ind = $(`#stepIndicator${i}`);
    const pane = $(`#aiStep${i}Pane`);
    if (ind) {
      ind.classList.toggle('active', i === step);
      ind.classList.toggle('completed', i < step);
    }
    if (pane) {
      pane.hidden = i !== step;
      pane.classList.toggle('active', i === step);
    }
  }
}

export function renderAiHubTab() {
  const state = getState();
  const ecoSelect = $('#aiTargetEcosystem');
  if (ecoSelect) {
    ecoSelect.innerHTML =
      `<option value="new">✨ Tự tạo Phả hệ mới theo vấn đề</option>` +
      state.ecosystems.map((e) => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>`).join('');
  }

  const hasKeys = hasAnyApiKey();
  const gatekeeperBox = $('#aiGatekeeperCard');
  const mainWorkflow = $('#aiMainWorkflow');

  if (!hasKeys && !isGatekeeperBypassed) {
    if (gatekeeperBox) gatekeeperBox.hidden = false;
    if (mainWorkflow) mainWorkflow.hidden = true;
  } else {
    if (gatekeeperBox) gatekeeperBox.hidden = true;
    if (mainWorkflow) mainWorkflow.hidden = false;
    syncActiveKeyDropdown();
  }
}

export function syncActiveKeyDropdown() {
  const keySelect = $('#aiActiveKeySelect');
  if (!keySelect) return;
  const keys = getUserApiKeys();
  const activeId = getActiveApiKeyId();

  if (keys.length === 0) {
    keySelect.innerHTML = `<option value="">(Chưa có Key — Chạy Mẫu)</option>`;
    return;
  }

  keySelect.innerHTML = keys
    .map(
      (k) =>
        `<option value="${escapeHTML(k.id)}" ${k.id === activeId ? 'selected' : ''}>${escapeHTML(k.name)} (${escapeHTML(
          k.model || k.provider
        )})</option>`
    )
    .join('');
  keySelect.value = activeId || keys[0]?.id || '';
}

export const JSON_SCHEMA_EXAMPLE = `{
  "lineageTitle": "Phả hệ: [Tên đề tài ngắn gọn]",
  "papers": [
    {
      "tempId": "p1",
      "title": "[Tên bài báo học thuật chuẩn quốc tế đầy đủ bằng tiếng Anh]",
      "authors": "[Tác giả chính (VD: Ratner et al.)]",
      "year": 2016,
      "venue": "[NeurIPS / ICML / ICLR / ACL / Nature / IEEE]",
      "coreKnowledge": "[Trụ cột 1: Đóng góp & phát hiện cốt lõi, 1-2 câu súc tích]",
      "methodPipeline": "[Trụ cột 2: Quy trình phương pháp luận từ vấn đề đến giải pháp]",
      "conditions": [
        { "category": "method", "factor": "[Tên giả định/điều kiện]", "value": "[Điều kiện cụ thể để bài báo đúng]" }
      ],
      "materials": "[Trụ cột 4: Tập dữ liệu, benchmark và quy mô thực nghiệm]",
      "evidence": "[Trụ cột 5: Kết quả thực nghiệm và số liệu đo lường cụ thể]",
      "limitations": "[Trụ cột 6: Điểm gãy suy luận - khi nào bài báo bị sai hoặc sụp đổ]"
    },
    {
      "tempId": "p2",
      "title": "[Tên bài báo phát triển/kế thừa/bảo vệ p1]",
      "authors": "[Tác giả]",
      "year": 2019,
      "venue": "[ICML]",
      "coreKnowledge": "[Trụ cột 1: Đóng góp mở rộng hoặc củng cố p1]",
      "methodPipeline": "[Trụ cột 2: Phương pháp]",
      "conditions": [{ "category": "environment", "factor": "Miền kiểm thử", "value": "Điều kiện" }],
      "materials": "[Trụ cột 4: Dataset]",
      "evidence": "[Trụ cột 5: Kết quả]",
      "limitations": "[Trụ cột 6: Hạn chế]"
    },
    {
      "tempId": "p3",
      "title": "[Tên bài báo TẤN CÔNG / BÁC BỎ TRỰC DIỆN p1 hoặc p2]",
      "authors": "[Tác giả tấn công]",
      "year": 2021,
      "venue": "[NeurIPS]",
      "coreKnowledge": "[Chỉ ra p1 sai lầm khi vi phạm điều kiện X]",
      "methodPipeline": "[Thiết kế đòn tấn công phản bác]",
      "conditions": [{ "category": "data", "factor": "Nhiễu tương quan", "value": "Điều kiện gây sụp đổ" }],
      "materials": "[Benchmark đối kháng]",
      "evidence": "[Tỷ lệ lỗi tăng vọt khi bị tấn công]",
      "limitations": "[Hạn chế bài tấn công]"
    }
  ],
  "relations": [
    {
      "from": "p2",
      "to": "p1",
      "type": "lineage",
      "label": "Kế thừa và mở rộng giả định của p1",
      "conditionNote": "Mở rộng giả định"
    },
    {
      "from": "p3",
      "to": "p1",
      "type": "refute",
      "label": "TẤN CÔNG: Bác bỏ p1 dưới điều kiện tương quan ẩn",
      "conditionNote": "Điều kiện gây sụp đổ"
    }
  ]
}`;

export function buildEpistemicMetaPrompt({ provider, mode, phenomenon, chain, targetPaper, targetCore, attackReq }) {
  if (mode === 'decompose') {
    return [
      `Bạn là một Chuyên gia Thiết kế Prompt Nghiên cứu Khoa học (Senior Epistemic Prompt Architect) cho hệ thống Đồ thị Filio3D.`,
      `Nhiệm vụ của bạn là tiếp nhận hiện tượng / chuỗi suy luận nghiên cứu thô của người dùng và TINH CHẾ nó thành một "SUPER PROMPT" hoàn chỉnh, học thuật và chặt chẽ nhất, được tối ưu hóa riêng cho mô hình ${provider}.`,
      ``,
      `DỮ LIỆU THÔ CỦA NGƯỜI DÙNG:`,
      `- Hiện tượng / Đề tài: "${phenomenon}"`,
      `- Chuỗi phân rã suy luận thô:`,
      chain,
      ``,
      `YÊU CẦU BẮT BUỘC ĐỐI VỚI SUPER PROMPT ĐƯỢC SINH RA:`,
      `1. Phải yêu cầu mô hình tra cứu văn hiến bình duyệt thực tế (NeurIPS, ICML, ICLR, ACL, KDD, Nature, IEEE).`,
      `2. BẮT BUỘC phải yêu cầu tìm ít nhất 3 đến 4 BÀI BÁO THẬT ĐỐI LẬP NHAU TRONG PHẢ HỆ:`,
      `   - Ít nhất 1 bài báo nền móng (Foundation - p1).`,
      `   - Ít nhất 1 bài báo kế thừa / phát triển (Defense / Extension - p2).`,
      `   - Ít nhất 1-2 bài báo TẤN CÔNG / BÁC BỎ TRỰC DIỆN (Attacker / Refutation - p3, p4) chỉ ra điều kiện cụ thể làm sụp đổ phương pháp của bài trước.`,
      `3. BẮT BUỘC mô hình trích xuất đầy đủ 7 TRỤ CỘT TRI THỨC KHOA HỌC cho TỪNG BÀI BÁO (coreKnowledge, methodPipeline, conditions, materials, evidence, limitations).`,
      `4. BẮT BUỘC YÊU CẦU MÔ HÌNH TRẢ VỀ DUY NHẤT 1 KHỐI JSON THEO ĐÚNG CẤU TRÚC SAU:`,
      `\`\`\`json`,
      JSON_SCHEMA_EXAMPLE,
      `\`\`\``,
      `5. BẮT BUỘC GHI RÕ TRONG PROMPT: Tuyệt đối không trả về các key tự do như 'researchProblem' hay 'audit'. Mọi bài báo BẮT BUỘC phải là một phần tử độc lập nằm trong mảng "papers" và có ít nhất 1 quan hệ "refute" trong mảng "relations".`,
      ``,
      `HÃY TRẢ VỀ DUY NHẤT TOÀN VĂN NỘI DUNG "SUPER PROMPT" ĐÃ TINH CHẾ ĐỂ THỰC THI NGAY. KHÔNG THÊM LỜI CHÀO HỎI HOẶC GIẢI THÍCH DƯ THỪA.`,
    ].join('\n');
  }

  // mode === 'attack_defense'
  return [
    `Bạn là một Chuyên gia Thiết kế Prompt Nghiên cứu Khoa học (Senior Epistemic Prompt Architect) cho hệ thống Đồ thị Filio3D.`,
    `Nhiệm vụ của bạn là tiếp nhận thông tin bài báo mục tiêu và TINH CHẾ nó thành một "SUPER PROMPT" Phản biện Đối kháng hoàn chỉnh, tối ưu riêng cho mô hình ${provider}.`,
    ``,
    `BÀI BÁO MỤC TIÊU:`,
    `- Tên bài báo: "${targetPaper}"`,
    `- Đóng góp tuyên bố: "${targetCore}"`,
    `- Yêu cầu tấn công/phòng thủ: "${attackReq}"`,
    ``,
    `YÊU CẦU BẮT BUỘC ĐỐI VỚI SUPER PROMPT ĐƯỢC SINH RA:`,
    `1. Yêu cầu mô hình định vị chính xác bài báo gốc (p1) cùng các giả định biên và điểm yếu chí mạng của nó.`,
    `2. BẮT BUỘC phải yêu cầu tìm ít nhất 3 đến 4 BÀI BÁO THẬT:`,
    `   - Bài báo mục tiêu (p1)`,
    `   - Bài báo kế thừa / bảo vệ (p2)`,
    `   - Ít nhất 1-2 bài báo TẤN CÔNG / BÁC BỎ TRỰC DIỆN (p3, p4) chỉ ra điều kiện gây sụp đổ bài gốc.`,
    `3. Trích xuất đầy đủ 7 TRỤ CỘT TRI THỨC KHOA HỌC cho mỗi bài báo.`,
    `4. BẮT BUỘC YÊU CẦU MÔ HÌNH TRẢ VỀ DUY NHẤT 1 KHỐI JSON THEO ĐÚNG CẤU TRÚC SAU:`,
    `\`\`\`json`,
    JSON_SCHEMA_EXAMPLE,
    `\`\`\``,
    `5. BẮT BUỘC GHI RÕ TRONG PROMPT: Mọi bài báo BẮT BUỘC phải nằm trong mảng "papers" và có các liên kết "refute" (tấn công) trong mảng "relations".`,
    ``,
    `HÃY TRẢ VỀ DUY NHẤT TOÀN VĂN NỘI DUNG "SUPER PROMPT" ĐÃ TINH CHẾ. KHÔNG THÊM LỜI CHÀO HỎI HOẶC GIẢI THÍCH DƯ THỪA.`,
  ].join('\n');
}

export function buildAiResearchPrompt() {
  const mode = selectedAiMode;
  const activeKey = getActiveApiKeyRecord();
  const provider = activeKey?.provider || 'gemini-api';

  // =========================================================================
  // CHẾ ĐỘ 1: PHÂN RÃ HIỆN TƯỢNG ĐẾN CÂU HỎI NGHIÊN CỨU
  // =========================================================================
  if (mode === 'decompose') {
    const phenomenon = ($('#aiTopicInput')?.value || '').trim() || 'Hiện tượng nghiên cứu';
    const chain = ($('#aiDecomposeChainInput')?.value || '').trim() || 'Chuỗi phân rã suy luận';

    // 1.1 Tối ưu cho Anthropic Claude
    if (provider === 'claude-api') {
      return [
        `<system_role>`,
        `Bạn là một nhà khoa học nghiên cứu cấp cao (Senior Research Epistemologist) của Filio3D.`,
        `Nhiệm vụ: Đối chiếu chuỗi phân rã hiện tượng sau với văn hiến học thuật bình duyệt thực tế (NeurIPS, ICML, ICLR, ACL, KDD, Nature, IEEE), tìm 3-4 bài báo đối lập (nền móng, bảo vệ, và tấn công phản bác trực diện) theo 7 TRỤ CỘT TRI THỨC.`,
        `</system_role>`,
        ``,
        `<research_decomposition>`,
        `<phenomenon_and_topic>${phenomenon}</phenomenon_and_topic>`,
        `<reasoning_chain>`,
        chain,
        `</reasoning_chain>`,
        `</research_decomposition>`,
        ``,
        `<epistemic_instructions>`,
        `1. Tìm ít nhất 3-4 bài báo khoa học thực tế:`,
        `   - p1: Bài báo nền móng (Foundation).`,
        `   - p2: Bài báo kế thừa / mở rộng (Defense / Lineage).`,
        `   - p3, p4: Bài báo TẤN CÔNG / BÁC BỎ (Attacker / Refutation) chỉ ra điều kiện gây sụp đổ.`,
        `2. Bóc tách nghiêm ngặt 7 Trụ Cột Tri Thức cho từng bài báo.`,
        `3. Trả về DUY NHẤT một khối JSON hợp lệ theo đúng cấu trúc mẫu sau (tuyệt đối không dùng key tự do):`,
        `\`\`\`json`,
        JSON_SCHEMA_EXAMPLE,
        `\`\`\``,
        `</epistemic_instructions>`,
      ].join('\n');
    }

    // 1.2 Tối ưu cho Google Gemini
    if (provider === 'gemini-api') {
      return [
        `Bạn là chuyên gia phân tích Phả hệ Nghiên cứu Khoa học của hệ thống Filio3D.`,
        `Hãy đối chiếu các luận điểm nghiên cứu và chuỗi phân rã suy luận sau đây với văn hiến học thuật thực tế:`,
        ``,
        `HIỆN TƯỢNG / VẤN ĐỀ: "${phenomenon}"`,
        `CHUỖI PHÂN RÃ SUY LUẬN & GIẢ THUYẾT:`,
        chain,
        ``,
        `YÊU CẦU BẮT BUỘC:`,
        `1. Tìm ít nhất 3 đến 4 BÀI BÁO KHOA HỌC THẬT ĐỐI LẬP NHAU TRONG PHẢ HỆ:`,
        `   - p1: Bài báo nền móng (Foundation).`,
        `   - p2: Bài báo kế thừa / phát triển (Lineage/Defense).`,
        `   - p3, p4: Bài báo TẤN CÔNG / BÁC BỎ TRỰC DIỆN (Attacker/Refutation) chỉ ra điểm gãy suy luận.`,
        `2. Bóc tách mỗi bài báo đầy đủ 7 Trụ Cột: coreKnowledge, methodPipeline, conditions, materials, evidence, limitations.`,
        `3. BẮT BUỘC trả về DUY NHẤT 1 khối JSON chuẩn, tất cả bài báo nằm trong mảng "papers" và quan hệ trong mảng "relations":`,
        `\`\`\`json`,
        JSON_SCHEMA_EXAMPLE,
        `\`\`\``,
      ].join('\n');
    }

    // 1.3 Tối ưu cho OpenAI GPT
    return [
      `[Role: Senior AI Research Epistemologist for Filio3D Graph]`,
      `[Task: Ground user phenomenon decomposition into 3-4 real dialectical scientific papers across 7 Epistemic Pillars]`,
      ``,
      `User Phenomenon: "${phenomenon}"`,
      `Decomposition Reasoning Chain:`,
      chain,
      ``,
      `Instructions:`,
      `1. Find 3-4 real peer-reviewed scientific papers (foundation p1, extension p2, and refuting attacks p3/p4).`,
      `2. Extract the 7 Knowledge Pillars for each paper: coreKnowledge, methodPipeline, conditions, materials, evidence, limitations.`,
      `3. Output strictly valid JSON matching this schema:`,
      `\`\`\`json`,
      JSON_SCHEMA_EXAMPLE,
      `\`\`\``,
    ].join('\n');
  }

  // =========================================================================
  // CHẾ ĐỘ 2: ĐƯA 1 BÀI BÁO CỤ THỂ ➔ TÌM ĐÒN TẤN CÔNG & PHÒNG THỦ
  // =========================================================================
  const targetPaper = ($('#aiTargetPaperInput')?.value || '').trim() || 'Bài báo mục tiêu';
  const targetCore = ($('#aiTargetCoreInput')?.value || '').trim() || 'Đóng góp chính';
  const attackReq = ($('#aiAttackInstruction')?.value || '').trim();

  // 2.1 Claude
  if (provider === 'claude-api') {
    return [
      `<system_role>`,
      `Bạn là chuyên gia Phản biện Học thuật (Peer-Review Critic & Epistemic Defense/Attack Analyst) của Filio3D.`,
      `Nhiệm vụ: Phân tích bài báo mục tiêu, tìm các công trình bảo vệ (Defense) và các công trình TẤN CÔNG / BÁC BỎ (Attacker/Refutation) theo 7 TRỤ CỘT TRI THỨC.`,
      `</system_role>`,
      ``,
      `<target_paper>`,
      `<title_and_citation>${targetPaper}</title_and_citation>`,
      `<core_claim>${targetCore}</core_claim>`,
      `<inquiry_directive>${attackReq}</inquiry_directive>`,
      `</target_paper>`,
      ``,
      `<dialectical_mapping_requirements>`,
      `1. Tìm 3-4 bài báo khoa học thực tế: p1 (bài mục tiêu), p2 (kế thừa/bảo vệ), p3 (tấn công bác bỏ trực diện).`,
      `2. Bóc tách rõ 7 Trụ Cột cho mỗi bài báo.`,
      `3. Trả về DUY NHẤT một khối JSON hợp lệ theo đúng cấu trúc:`,
      `\`\`\`json`,
      JSON_SCHEMA_EXAMPLE,
      `\`\`\``,
      `</dialectical_mapping_requirements>`,
    ].join('\n');
  }

  // 2.2 Gemini & GPT
  return [
    `Bạn là chuyên gia phân tích Đòn Tấn công & Phòng thủ Học thuật của Filio3D.`,
    `Bài báo mục tiêu: "${targetPaper}"`,
    `Đóng góp cốt lõi: "${targetCore}"`,
    `Yêu cầu: ${attackReq}`,
    ``,
    `Hãy tìm 3-4 bài báo thực tế trong văn hiến: bài gốc (p1), bài kế thừa bảo vệ (p2), và các bài TẤN CÔNG / BÁC BỎ (p3, p4) chỉ ra điều kiện gây sụp đổ p1.`,
    `Bóc tách rõ 7 TRỤ CỘT TRI THỨC KHOA HỌC cho từng bài báo.`,
    `Trả về duy nhất khối JSON chuẩn:`,
    `\`\`\`json`,
    JSON_SCHEMA_EXAMPLE,
    `\`\`\``,
  ].join('\n');
}

/**
 * Làm sạch chuỗi văn bản của từng trường:
 * - Loại bỏ hoàn toàn dấu ngoặc xoắn {, }, ngoặc vuông [, ]
 * - Loại bỏ các key JSON trơ trọi như "researchProblem":, "pillar4_materials":
 * - Loại bỏ dấu nháy kép thừa
 * - Tuyệt đối không để chuỗi "{", "}", hoặc rỗng lọt vào card
 */
function cleanFieldText(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map((item) => cleanFieldText(item)).filter(Boolean).join('; ') || fallback;
    }
    const cleanPairs = Object.entries(val)
      .map(([k, v]) => `${k}: ${cleanFieldText(v)}`)
      .filter((s) => !s.startsWith('{') && !s.endsWith('{') && s.length > 3);
    return cleanPairs.join('; ') || fallback;
  }
  let str = String(val).trim();
  // Strip raw JSON artifacts: leading/trailing braces, brackets, quotes
  str = str.replace(/^[\s{}"'\[\]]+|[\s{}"'\[\]]+$/g, '');
  // Strip leading property keys like "researchProblem": or "pillar4_materials":
  str = str.replace(/^[a-zA-Z0-9_\-\s]+["']?\s*:\s*["']?/i, '');
  // Strip leading bullet headers
  str = str.replace(/^[-*•]\s*(?:Tri thức|Đóng góp|Phương pháp|Quy trình|Điều kiện|Giả định|Nguyên liệu|Dataset|Bằng chứng|Kết quả|Điểm gãy|Giới hạn)?[:\s]*/i, '');
  str = str.replace(/^["']|["']$/g, '').trim();
  if (str === '{' || str === '}' || str === '[]' || str === '{}' || str === '""' || !str) {
    return fallback;
  }
  return str;
}

/**
 * Tự động sửa chữa JSON bị cắt cụt do giới hạn token
 */
function tryRepairAndParseJson(text) {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Thử parse trực tiếp
  try {
    return JSON.parse(trimmed);
  } catch (e) {}

  // 2. Tìm khối ```json ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {}
  }

  // 3. Trích xuất từ dấu { đầu tiên đến dấu } cuối cùng
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (e) {}
  }

  // 4. Trích xuất từ dấu [ đầu tiên đến dấu ] cuối cùng
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const arr = JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
      return { papers: arr };
    } catch (e) {}
  }

  // 5. Tự động đóng ngoặc đối với JSON bị ngắt giữa chừng
  if (firstBrace !== -1) {
    let candidate = trimmed.slice(firstBrace);
    const lastQuote = candidate.lastIndexOf('"');
    if (lastQuote > 0) {
      const sub = candidate.slice(0, lastQuote + 1);
      const openBraces = (sub.match(/\{/g) || []).length;
      const closeBraces = (sub.match(/\}/g) || []).length;
      const openBrackets = (sub.match(/\[/g) || []).length;
      const closeBrackets = (sub.match(/\]/g) || []).length;
      let repaired = sub;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        return JSON.parse(repaired);
      } catch (e) {}
    }
  }

  return null;
}

/**
 * Trích xuất danh sách bài báo từ mọi dạng JSON mà LLM có thể trả về:
 * - Chuẩn: { papers: [...] }
 * - Mảng trực tiếp: [ {...}, {...} ]
 * - Danh mục từ điển: { "ratner2016_audit": "...", "li2020_audit": "..." }
 */
function extractPapersFromParsedObject(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];

  // Chuẩn 1: { papers: [...] }
  if (Array.isArray(parsed.papers) && parsed.papers.length > 0) {
    return parsed.papers;
  }

  // Chuẩn 2: [ {...}, {...} ]
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed;
  }

  // Chuẩn 3: Các key đồng nghĩa (sources, literature, nodes, articles)
  for (const k of ['sources', 'literature', 'nodes', 'articles', 'items']) {
    if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
      return parsed[k];
    }
  }

  // Chuẩn 4: Object chứa các bài báo con { "p1": {...}, "p2": {...} }
  const objValues = Object.values(parsed).filter(
    (v) => v && typeof v === 'object' && !Array.isArray(v) && (v.title || v.coreKnowledge || v.authors)
  );
  if (objValues.length > 0) {
    return objValues;
  }

  // Chuẩn 5: Audit Map (Dạng key-value phân tích mà Gemini thường sinh khi prompt thiếu schema: { "ratner2016_audit": "...", "li2020_audit": "..." })
  const extracted = [];
  const entries = Object.entries(parsed);
  entries.forEach(([key, val], idx) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'researchproblem' ||
      lowerKey === 'lineagetitle' ||
      lowerKey === 'topic' ||
      lowerKey.includes('pillar') ||
      lowerKey.includes('material') ||
      lowerKey.includes('dataset') ||
      lowerKey.includes('benchmark')
    ) {
      return;
    }
    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (valStr.length < 30) return;

    // Trích xuất tên tác giả, năm và hội nghị từ văn bản
    const citeMatch = valStr.match(/([A-Z][a-zA-Z\s]+(?:et al\.)?)\s*\((?:([A-Z0-9]+)\s+)?(19\d\d|20[0-2]\d)\)/);
    const keyMatch = key.match(/([a-zA-Z]+)(19\d\d|20[0-2]\d)/);

    let authors = 'Tác giả học thuật';
    let year = 2018 + idx;
    let venue = 'Hội nghị uy tín';
    let title = '';

    if (citeMatch) {
      authors = citeMatch[1].trim();
      year = parseInt(citeMatch[3], 10);
      if (citeMatch[2]) venue = citeMatch[2];
      const titlePrefix = valStr.match(/^([A-Za-z0-9\s:–-]+?)\s*\(/);
      if (titlePrefix && titlePrefix[1].length > 6) {
        title = titlePrefix[1].trim();
      } else {
        title = `${authors} (${venue} ${year})`;
      }
    } else if (keyMatch) {
      authors = keyMatch[1].charAt(0).toUpperCase() + keyMatch[1].slice(1) + ' et al.';
      year = parseInt(keyMatch[2], 10);
      title = `Nghiên cứu ${authors} (${year})`;
    } else {
      title = `Nghiên cứu #${idx + 1}: ${key.replace(/_/g, ' ')}`;
    }

    const cleanVal = valStr.replace(/\b([A-Za-z]+)\.\s+/g, (m, word) => {
      if (['al', 'e', 'g', 'i', 'vs', 'dr', 'prof'].includes(word.toLowerCase())) {
        return word + ' ';
      }
      return m;
    });
    const sentences = cleanVal.split(/(?<=[.!?])\s+/);
    let core = sentences[0] || valStr;
    if (core.length < 35 && sentences[1]) {
      core = core + ' ' + sentences[1];
    }
    const limit =
      sentences.find((s) => /(phản bác|tấn công|ngụy biện|sụp đổ|hạn chế|thất bại|không còn|sai|limitation)/i.test(s)) ||
      'Điểm gãy khi vi phạm điều kiện thực nghiệm.';
    const method =
      sentences.find((s) => /(phương pháp|mô hình|thuật toán|pipeline|framework|phương thức)/i.test(s)) ||
      `Phương pháp luận kiểm chứng theo ${authors}`;
    const evidence =
      sentences.find((s) => /(chứng minh|thực nghiệm|độ chính xác|kết quả|f1|dataset|loss)/i.test(s)) ||
      'Đã kiểm chứng thực nghiệm theo công bố của tác giả.';

    extracted.push({
      tempId: `p${extracted.length + 1}`,
      title: cleanFieldText(title, `Nghiên cứu ${authors} (${year})`),
      authors: cleanFieldText(authors, 'Tác giả học thuật'),
      year,
      venue: cleanFieldText(venue, 'Hội nghị quốc tế'),
      coreKnowledge: cleanFieldText(core, 'Đóng góp tri thức cốt lõi.'),
      methodPipeline: cleanFieldText(method, 'Quy trình phương pháp luận.'),
      conditions: [{ category: 'method', factor: 'Giả định tiên đề', value: 'Trong miền phân phối kiểm thử thực nghiệm' }],
      materials: cleanFieldText(parsed.pillar4_materials || 'Tập dữ liệu và benchmark chuẩn'),
      evidence: cleanFieldText(evidence, 'Kiểm chứng thực nghiệm công bố.'),
      limitations: cleanFieldText(limit, 'Điểm gãy khi bị tấn công hoặc vi phạm điều kiện.'),
    });
  });

  return extracted;
}

/**
 * Trích xuất hoặc tự động sinh liên kết phả hệ biện chứng (refute / lineage)
 */
function extractRelationsFromParsedObject(parsed, papers) {
  if (Array.isArray(parsed?.relations) && parsed.relations.length > 0) {
    return parsed.relations;
  }
  const relations = [];
  if (papers && papers.length >= 2) {
    for (let i = 1; i < papers.length; i++) {
      const p = papers[i];
      const isRefute = /(bác bỏ|tấn công|sụp đổ|phản biện|ngụy biện|refute|attack|fail)/i.test(
        (p.title || '') + ' ' + (p.coreKnowledge || '') + ' ' + (p.limitations || '')
      );
      relations.push({
        from: p.tempId || `p${i + 1}`,
        to: papers[0].tempId || 'p1',
        type: isRefute ? 'refute' : 'lineage',
        label: isRefute
          ? `TẤN CÔNG: Bác bỏ giả định của ${papers[0].authors || 'bài trước'}`
          : `Kế thừa và củng cố phả hệ`,
        conditionNote: isRefute ? 'Điều kiện làm sụp đổ phương pháp' : 'Mở rộng giả định',
      });
    }
  }
  return relations;
}

/**
 * Bộ Trung Gian Chuẩn Hóa (`parseRawAiOutputToGraph`):
 * Bóc tách cả JSON lẫn văn bản Markdown tự do thành 7 Trụ Cột Tri Thức Khoa Học + Mũi tên 3D.
 */
export function parseRawAiOutputToGraph(rawText, metadata = {}) {
  const text = (rawText || '').trim();
  if (!text) return null;

  // 1. Thử parse qua JSON Engine (hỗ trợ cả JSON bị cắt, mảng, audit map)
  const parsedJson = tryRepairAndParseJson(text);
  if (parsedJson) {
    const extractedPapers = extractPapersFromParsedObject(parsedJson);
    if (extractedPapers.length > 0) {
      const extractedRelations = extractRelationsFromParsedObject(parsedJson, extractedPapers);
      let lineageTitle =
        parsedJson.lineageTitle ||
        parsedJson.researchProblem ||
        ($('#aiTopicInput')?.value || '').trim() ||
        'Phả hệ Biện chứng Học thuật';
      lineageTitle = cleanFieldText(lineageTitle, 'Phả hệ Biện chứng Học thuật');

      return normalizeParsedObject(
        {
          lineageTitle,
          papers: extractedPapers,
          relations: extractedRelations,
        },
        metadata
      );
    }
  }

  // 2. Fallback: Parse văn bản Markdown tự do (Tách theo tiêu đề hoặc trích dẫn tác giả)
  const blocks = text
    .split(/\n(?=(?:#{1,4}\s|\d+\.\s+\*\*|\*\*Bài báo|\*\*Paper|[A-Z][a-zA-Z\s]+(?:et al\.)?\s*\((?:[A-Z0-9]+\s+)?(?:19|20)\d\d\)))/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 25);

  const papers = [];
  const relations = [];

  blocks.forEach((blk, idx) => {
    const lines = blk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rawHeader = lines[0].replace(/^[#*0-9.\-–\s]+/, '').replace(/\*+/g, '').trim();
    const yearMatch = blk.match(/\b(19\d\d|20[0-2]\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2020 + idx;

    const condLine =
      lines.find((l) => /(điều kiện|giả định|condition|assumption| đúng khi)/i.test(l)) ||
      'Trong điều kiện tiêu chuẩn của tập dữ liệu thực nghiệm';
    const limitLine =
      lines.find((l) => /(điểm gãy|giới hạn|tấn công|bác bỏ|sụp đổ|sai khi|limitation|fail|attack)/i.test(l)) ||
      'Cần kiểm chứng thêm khi nhiễu lớn hoặc lệch miền';
    const methodLine =
      lines.find((l) => /(phương pháp|quy trình|kiến trúc|pipeline|method|algorithm)/i.test(l)) ||
      'Quy trình xây dựng mô hình và phương pháp kiểm thử thực nghiệm';
    const matLine =
      lines.find((l) => /(nguyên liệu|tài nguyên|dataset|dữ liệu|tập dữ liệu|material|benchmark)/i.test(l)) ||
      'Tập dữ liệu chuẩn theo phân phối khảo cứu';
    const evLine =
      lines.find((l) => /(bằng chứng|kết quả|thực nghiệm|phát hiện|evidence|metric|f1|accuracy)/i.test(l)) ||
      'Đã kiểm chứng thực nghiệm theo số liệu tác giả công bố';
    const coreLine =
      lines.find((l, i) => i > 0 && l !== condLine && l !== limitLine && l !== methodLine && l !== matLine && l !== evLine) ||
      rawHeader;

    const tempId = `ai-p${idx + 1}`;
    papers.push({
      tempId,
      title: cleanFieldText(rawHeader.slice(0, 115), `Bài báo #${idx + 1}`),
      authors: `Nghiên cứu #${idx + 1}`,
      year,
      venue: 'AI Extracted',
      coreKnowledge: cleanFieldText(coreLine, 'Đóng góp và phát hiện cốt lõi của bài báo.'),
      methodPipeline: cleanFieldText(methodLine, 'Quy trình phương pháp luận từ vấn đề đến giải pháp.'),
      conditions: [
        {
          category: 'method',
          factor: 'Điều kiện tồn tại',
          value: cleanFieldText(condLine, 'Trong điều kiện giả định thực nghiệm.'),
        },
      ],
      materials: cleanFieldText(matLine, 'Tập dữ liệu chuẩn khảo cứu.'),
      evidence: cleanFieldText(evLine, 'Đã kiểm chứng kết quả thực nghiệm.'),
      limitations: cleanFieldText(limitLine, 'Điểm gãy khi lệch miền phân phối hoặc bị tấn công.'),
    });

    if (idx > 0) {
      const isAttack = /(tấn công|bác bỏ|phản bác|sụp đổ|mâu thuẫn|attack|refute|fail)/i.test(blk);
      relations.push({
        from: isAttack ? tempId : `ai-p${idx}`,
        to: isAttack ? `ai-p${idx}` : tempId,
        type: isAttack ? 'refute' : 'lineage',
        label: isAttack
          ? `Tấn công / Bác bỏ giả định của bài trước (${year})`
          : `Kế thừa và phát triển tiếp phả hệ (${year})`,
        conditionNote: isAttack ? 'Tấn công làm sụp đổ giả định' : 'Mở rộng phả hệ',
      });
    }
  });

  return normalizeParsedObject(
    {
      lineageTitle: ($('#aiTopicInput')?.value || 'Phả hệ Biện chứng Học thuật').trim(),
      papers,
      relations,
    },
    metadata
  );
}

function normalizeParsedObject(obj, metadata = {}) {
  const idMap = new Map();
  const cleanPapers = (obj.papers || []).map((p, i) => {
    const newId = `p-ai-${Date.now().toString(36).slice(-3)}-${i + 1}`;
    idMap.set(p.tempId || p.id || `p${i + 1}`, newId);

    const title = cleanFieldText(p.title, `Bài báo #${i + 1}`);
    const authors = cleanFieldText(p.authors, 'Tác giả học thuật');
    const venue = cleanFieldText(p.venue, 'Hội nghị quốc tế');
    const coreKnowledge = cleanFieldText(p.coreKnowledge || p.summary, title);
    const methodPipeline = cleanFieldText(p.methodPipeline || p.methodology, 'Quy trình phương pháp luận và thuật toán.');
    const materials = cleanFieldText(p.materials || p.datasets, 'Tập dữ liệu và tài nguyên thực nghiệm chuẩn.');
    const evidence = cleanFieldText(p.evidence || p.findings, 'Đã kiểm chứng kết quả thực nghiệm trên các chỉ số đo lường.');
    const limitations = cleanFieldText(p.limitations, 'Điểm gãy khi vi phạm điều kiện biên hoặc bị tấn công.');

    const conds = Array.isArray(p.conditions)
      ? p.conditions.map((c) =>
          typeof c === 'string'
            ? { category: 'method', factor: 'Điều kiện', value: cleanFieldText(c, 'Điều kiện tiên đề') }
            : {
                category: c.category || 'method',
                factor: cleanFieldText(c.factor, 'Điều kiện'),
                value: cleanFieldText(c.value, 'Điều kiện cần để phương pháp đúng'),
              }
        )
      : [
          {
            category: 'method',
            factor: 'Điều kiện tồn tại',
            value: cleanFieldText(p.conditions, 'Theo giả định tiêu chuẩn của bài báo'),
          },
        ];

    const internalChain = Array.isArray(p.internalChain) && p.internalChain.length
      ? p.internalChain
      : [
          { stage: 'Vấn đề', text: title },
          { stage: 'Điều kiện', text: conds.map((c) => c.value).join('; ') },
          { stage: 'Phương pháp', text: methodPipeline },
          { stage: 'Kết luận', text: coreKnowledge },
        ];

    return {
      id: newId,
      tempId: p.tempId || `p${i + 1}`,
      title,
      authors,
      year: parseInt(p.year, 10) || 2022,
      venue,
      provenance: p.provenance || {
        type: 'ai',
        model: metadata.model || 'Gemini 3.8 Flash',
        provider: metadata.provider || 'gemini-api',
        mode: metadata.mode || 'decompose',
        timestamp: Date.now(),
      },
      // 7 TRỤ CỘT TRI THỨC KHOA HỌC (ĐÃ LÀM SẠCH HOÀN TOÀN DẤU NGOẶC {})
      coreKnowledge,
      methodPipeline,
      conditions: conds,
      materials,
      evidence,
      limitations,
      internalChain,
    };
  });

  const cleanRelations = (obj.relations || [])
    .map((r) => ({
      id: `rel-ai-${crypto.randomUUID().slice(0, 6)}`,
      from: idMap.get(r.from) || cleanPapers[0]?.id,
      to: idMap.get(r.to) || cleanPapers[1]?.id,
      type: ARROW_TYPES[r.type] ? r.type : 'refute',
      label: cleanFieldText(r.label, 'Liên kết phả hệ biện chứng'),
      conditionNote: cleanFieldText(r.conditionNote, 'Điều kiện tương tác'),
    }))
    .filter((r) => r.from && r.to && r.from !== r.to);

  return {
    lineageTitle: cleanFieldText(obj.lineageTitle, 'Phả hệ Biện chứng Học thuật'),
    papers: cleanPapers,
    relations: cleanRelations,
  };
}

function renderStagingPreview() {
  const box = $('#stagingPreviewBox');
  if (!box) return;
  if (!stagedGraphData || !stagedGraphData.papers.length) {
    box.innerHTML = `<div class="staging-empty">Chưa có dữ liệu hợp lệ. Hãy bấm <b>"✨ AI Tinh Chế Prompt (Pha 1)"</b> hoặc <b>"⚡ Nạp Mẫu Có Sẵn"</b>.</div>`;
    return;
  }

  const summaryEl = $('#stagingModalSummary');
  if (summaryEl) {
    summaryEl.textContent = `${stagedGraphData.papers.length} bài báo · ${stagedGraphData.relations.length} liên kết phả hệ`;
  }

  box.innerHTML = `
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;padding:10px 12px;border-radius:8px;color:#065f46;font-size:12px;font-weight:600">
      ✔ Bộ Trung Gian đã chuẩn hóa thành công: <b>${stagedGraphData.papers.length} Bài báo (7 Trụ Cột Tri Thức)</b> & <b>${
    stagedGraphData.relations.length
  } Mũi tên 3D</b>. Bấm <b>"⚡ Nạp thẳng vào Không gian 3D"</b> ở trên để đưa vào đồ thị!
    </div>
    ${stagedGraphData.papers
      .map(
        (p) => `
      <div class="staged-paper-card">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:#4f46e5;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="staged-pid" style="background:#e0e7ff;padding:2px 6px;border-radius:4px">[${escapeHTML(p.tempId)}]</span>
            <span>${escapeHTML(p.authors)} (${p.year}) · <i>${escapeHTML(p.venue)}</i></span>
          </div>
          <span class="provenance-badge prov-ai" style="font-size:9.5px">🤖 ${escapeHTML(p.provenance?.model || 'AI')} Bóc Tách</span>
        </div>
        <div style="font-weight:800;font-size:13px;margin:2px 0 6px;color:#0f172a">${escapeHTML(p.title)}</div>
        
        <div class="staged-pillar-item" style="font-size:11.5px;color:#065f46">
          <b>💡 Trụ cột 1 (Đóng góp):</b> ${escapeHTML(p.coreKnowledge)}
        </div>
        <div class="staged-pillar-item" style="font-size:11px;color:#0369a1;margin-top:3px">
          <b>🔬 Trụ cột 2 (Phương pháp):</b> ${escapeHTML(p.methodPipeline)}
        </div>
        <div class="staged-pillar-item" style="font-size:11px;color:#92400e;margin-top:3px">
          <b>⚖ Trụ cột 3 (Điều kiện tồn tại):</b> ${escapeHTML(p.conditions.map((c) => `${c.factor}: ${c.value}`).join(' | '))}
        </div>
        <div class="staged-pillar-item" style="font-size:11px;color:#4338ca;margin-top:3px">
          <b>📦 Trụ cột 4 (Nguyên liệu & Dataset):</b> ${escapeHTML(p.materials)}
        </div>
        <div class="staged-pillar-item" style="font-size:11px;color:#047857;margin-top:3px">
          <b>📊 Trụ cột 5 (Bằng chứng & Kết quả):</b> ${escapeHTML(p.evidence)}
        </div>
        <div class="staged-pillar-item" style="font-size:11px;color:#b91c1c;margin-top:3px">
          <b>⚠️ Trụ cột 6 (Điểm gãy sụp đổ):</b> ${escapeHTML(p.limitations)}
        </div>
      </div>`
      )
      .join('')}
  `;
}

/**
 * Gọi trực tiếp LLM bằng API Key cá nhân của người dùng (BYOK)
 * - Hỗ trợ gọi trực tiếp từ trình duyệt (Gemini / OpenAI) hoặc qua Cloudflare Worker `/api/ai-proxy`.
 * - Hỗ trợ jsonMode để bắt buộc model trả về JSON hoàn chỉnh, không cắt cụt (maxOutputTokens: 8192).
 */
async function callCloudLlmWithUserKey({ provider, apiKey, model, prompt, jsonMode = false }) {
  // 1. Gọi trực tiếp Google Gemini API từ trình duyệt bằng Key của người dùng
  if (provider === 'gemini-api') {
    let cleanModel = (model || 'gemini-3.8-flash').trim();
    if (cleanModel === 'gemini-2.5-flash') {
      cleanModel = 'gemini-3.8-flash';
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 8192,
    };
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gemini API từ chối kết nối. Hãy kiểm tra lại API Key của bạn.');
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
    return { provider: `Gemini (${cleanModel})`, text };
  }

  // 2. Gọi trực tiếp OpenAI API bằng Key của người dùng
  if (provider === 'openai-api') {
    const cleanModel = model || 'gpt-4o-mini';
    const payload = {
      model: cleanModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    };
    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'OpenAI API từ chối kết nối. Hãy kiểm tra lại API Key của bạn.');
    }
    return { provider: `OpenAI (${cleanModel})`, text: data.choices?.[0]?.message?.content || '' };
  }

  // 3. Gọi Anthropic Claude API qua Cloudflare Worker Proxy (/api/ai-proxy) bằng Key của người dùng
  const proxyRes = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model, prompt, jsonMode }),
  });
  const proxyData = await proxyRes.json();
  if (!proxyRes.ok) {
    throw new Error(proxyData.message || 'Không thể kết nối tới API. Vui lòng kiểm tra API Key cá nhân của bạn.');
  }
  return proxyData;
}

// =========================================================================
// QUẢN LÝ KÉT KHÓA API KEY CÁ NHÂN (MULTI-KEY BYOK VAULT)
// =========================================================================

function openVaultModal() {
  const modal = $('#apiKeyVaultModal');
  if (modal) modal.hidden = false;
  resetVaultForm();
  renderVaultKeysList();
}

function closeVaultModal() {
  const modal = $('#apiKeyVaultModal');
  if (modal) modal.hidden = true;
  renderAiHubTab();
}

function resetVaultForm() {
  const editId = $('#vaultKeyEditId');
  if (editId) editId.value = '';
  const nameInput = $('#vaultKeyNameInput');
  if (nameInput) nameInput.value = '';
  const provSelect = $('#vaultKeyProviderSelect');
  if (provSelect) provSelect.value = 'gemini-api';
  const modelInput = $('#vaultKeyModelInput');
  if (modelInput) modelInput.value = 'gemini-3.8-flash';
  const secretInput = $('#vaultKeySecretInput');
  if (secretInput) {
    secretInput.value = '';
    secretInput.type = 'password';
  }
  const heading = $('#vaultFormHeading');
  if (heading) heading.textContent = '＋ Thêm API Key Mới';
  const cancelBtn = $('#btnCancelEditVaultKey');
  if (cancelBtn) cancelBtn.hidden = true;
}

function renderVaultKeysList() {
  const listEl = $('#vaultKeysList');
  const countEl = $('#vaultKeyCount');
  if (!listEl) return;

  const keys = getUserApiKeys();
  const activeId = getActiveApiKeyId();
  if (countEl) countEl.textContent = keys.length;

  if (keys.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:18px;color:#94a3b8;font-size:12px;border:1px dashed #475569;border-radius:8px">Chưa có API Key nào trong két. Hãy điền form phía trên để thêm key đầu tiên.</div>`;
    return;
  }

  listEl.innerHTML = keys
    .map((k) => {
      const isActive = k.id === activeId;
      const maskedKey = k.apiKey
        ? `${k.apiKey.slice(0, 6)}••••••••${k.apiKey.slice(-4)}`
        : '(chưa có key)';
      const provBadgeClass =
        k.provider === 'gemini-api'
          ? 'vault-badge-gemini'
          : k.provider === 'openai-api'
          ? 'vault-badge-openai'
          : 'vault-badge-claude';
      const provName =
        k.provider === 'gemini-api'
          ? 'Google Gemini'
          : k.provider === 'openai-api'
          ? 'OpenAI'
          : 'Anthropic Claude';

      return `
        <div class="vault-key-card ${isActive ? 'active-key' : ''}" data-key-id="${escapeHTML(k.id)}">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span class="vault-badge ${provBadgeClass}">${escapeHTML(provName)}</span>
              <b style="color:#f8fafc;font-size:12.5px">${escapeHTML(k.name)}</b>
              ${
                isActive
                  ? '<span style="font-size:10px;background:#059669;color:#fff;padding:1px 6px;border-radius:4px;font-weight:700">Đang chọn</span>'
                  : ''
              }
            </div>
            <div style="font-size:11px;color:#94a3b8;font-family:monospace">
              <span>Model: ${escapeHTML(k.model || 'mặc định')}</span> · <span>Key: ${escapeHTML(maskedKey)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${
              !isActive
                ? `<button type="button" class="secondary-button btn-vault-activate" data-id="${escapeHTML(
                    k.id
                  )}" style="padding:4px 8px;font-size:11px">Kích hoạt</button>`
                : ''
            }
            <button type="button" class="secondary-button btn-vault-edit" data-id="${escapeHTML(
              k.id
            )}" style="padding:4px 8px;font-size:11px" title="Chỉnh sửa">✎</button>
            <button type="button" class="danger-outline-button btn-vault-del" data-id="${escapeHTML(
              k.id
            )}" style="padding:4px 8px;font-size:11px" title="Xóa">🗑</button>
          </div>
        </div>
      `;
    })
    .join('');

  $$('.btn-vault-activate').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveApiKeyId(btn.dataset.id);
      renderVaultKeysList();
      syncActiveKeyDropdown();
      notify('✔ Đã kích hoạt API Key!');
    });
  });

  $$('.btn-vault-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const key = keys.find((x) => x.id === id);
      if (!key) return;
      $('#vaultKeyEditId').value = key.id;
      $('#vaultKeyNameInput').value = key.name || '';
      $('#vaultKeyProviderSelect').value = key.provider || 'gemini-api';
      $('#vaultKeyModelInput').value = key.model || 'gemini-3.8-flash';
      $('#vaultKeySecretInput').value = key.apiKey || '';
      $('#vaultFormHeading').textContent = '✎ Chỉnh Sửa API Key';
      $('#btnCancelEditVaultKey').hidden = false;
      $('#vaultKeyNameInput').focus();
    });
  });

  $$('.btn-vault-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('Bạn có chắc chắn muốn xóa API Key này khỏi két?')) {
        deleteUserApiKey(id);
        renderVaultKeysList();
        syncActiveKeyDropdown();
        notify('🗑 Đã xóa API Key khỏi két.');
      }
    });
  });
}

function ingestStagedGraphTo3D(switchViewFn) {
  const state = getState();
  if (!stagedGraphData || !stagedGraphData.papers.length) {
    notify('Chưa có dữ liệu bài báo hợp lệ để nạp vào 3D.');
    return;
  }

  let targetEcoId = $('#aiTargetEcosystem')?.value;
  if (!targetEcoId || targetEcoId === 'new') {
    const palette = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b'];
    targetEcoId = `eco-${crypto.randomUUID().slice(0, 6)}`;
    state.ecosystems.push({
      id: targetEcoId,
      title: stagedGraphData.lineageTitle || `Phả hệ: ${$('#aiTopicInput')?.value?.trim() || 'Nghiên cứu mới'}`,
      description: 'Phả hệ được bóc tách và tái tổ hợp qua Bộ Trung Gian AI (7 Trụ Cột Tri Thức).',
      color: palette[state.ecosystems.length % palette.length],
    });
  }

  stagedGraphData.papers.forEach((p) => {
    p.ecosystemId = targetEcoId;
    state.sources.push(p);
  });
  stagedGraphData.relations.forEach((r) => {
    state.relations.push(r);
  });

  sceneState.selectedLineageId = targetEcoId;
  sceneState.isolatedFocusNodeId = null;
  sceneState.activeNodeId = stagedGraphData.papers[0]?.id || null;
  saveState();

  // Đóng modal nổi nếu đang mở
  const stagingModal = $('#stagingViewerModal');
  if (stagingModal) stagingModal.hidden = true;

  if (typeof switchViewFn === 'function') switchViewFn('explore');
  renderSidebarLineages(switchViewFn);
  buildSceneGraph();
  fitCameraToVisibleScene();
  renderFloatingInspector();
  notify(`⚡ Đã nạp ${stagedGraphData.papers.length} bài báo vào Không gian 3D riêng của bạn!`);
}

export function initAiHubEvents(switchViewFn) {
  // 1. CHUYỂN CHẾ ĐỘ NGHIÊN CỨU
  $$('.ai-compact-modes .ai-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedAiMode = btn.dataset.aiMode;
      $$('.ai-compact-modes .ai-mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
      const decompPanel = $('#aiModeDecomposePanel');
      const attackPanel = $('#aiModeAttackDefensePanel');
      if (decompPanel) decompPanel.hidden = selectedAiMode !== 'decompose';
      if (attackPanel) attackPanel.hidden = selectedAiMode !== 'attack_defense';
    });
  });

  // 2. CHỌN KEY ĐANG HOẠT ĐỘNG TỪ DROPDOWN TOPBAR
  $('#aiActiveKeySelect')?.addEventListener('change', (e) => {
    if (e.target.value) {
      setActiveApiKeyId(e.target.value);
      notify('✔ Đã kích hoạt API Key: ' + e.target.options[e.target.selectedIndex].text);
    }
  });

  // 3. MỞ & ĐÓNG MODAL KÉT KHÓA (BYOK VAULT)
  $('#btnOpenKeyVault')?.addEventListener('click', openVaultModal);
  $('#btnGatekeeperAddKey')?.addEventListener('click', openVaultModal);
  $('#btnCloseKeyVaultModal')?.addEventListener('click', closeVaultModal);

  // 4. CHUYỂN ĐỔI ẨN / HIỆN KEY TRONG FORM VAULT
  $('#btnToggleVaultKeyVisibility')?.addEventListener('click', () => {
    const secretInput = $('#vaultKeySecretInput');
    if (secretInput) {
      secretInput.type = secretInput.type === 'password' ? 'text' : 'password';
    }
  });

  // 5. ĐỔI PROVIDER TRONG FORM VAULT -> TỰ ĐIỀN DEFAULT MODEL
  $('#vaultKeyProviderSelect')?.addEventListener('change', (e) => {
    const prov = e.target.value;
    const modelInput = $('#vaultKeyModelInput');
    if (!modelInput) return;
    if (prov === 'gemini-api') modelInput.value = 'gemini-3.8-flash';
    else if (prov === 'openai-api') modelInput.value = 'gpt-4o-mini';
    else if (prov === 'claude-api') modelInput.value = 'claude-3-5-sonnet';
  });

  // 6. LƯU KEY VÀO KÉT KHÓA
  $('#btnSaveVaultKey')?.addEventListener('click', () => {
    const name = ($('#vaultKeyNameInput')?.value || '').trim();
    const provider = $('#vaultKeyProviderSelect')?.value || 'gemini-api';
    const model = ($('#vaultKeyModelInput')?.value || '').trim() || 'gemini-3.8-flash';
    const apiKey = ($('#vaultKeySecretInput')?.value || '').trim();
    const editId = $('#vaultKeyEditId')?.value || '';

    if (!apiKey) {
      notify('⛔ Vui lòng nhập API Key bí mật của bạn.');
      $('#vaultKeySecretInput')?.focus();
      return;
    }

    const saved = saveUserApiKey({
      id: editId || undefined,
      name: name || (provider === 'gemini-api' ? 'Gemini Key' : provider === 'openai-api' ? 'OpenAI Key' : 'Claude Key'),
      provider,
      model,
      apiKey,
      makeActive: true,
    });

    if (saved) {
      resetVaultForm();
      renderVaultKeysList();
      syncActiveKeyDropdown();
      notify('✔ Đã lưu API Key thành công vào Két Khóa cá nhân!');
    }
  });

  $('#btnCancelEditVaultKey')?.addEventListener('click', resetVaultForm);

  // 7. NẠP DỮ LIỆU MẪU TẠI GATEKEEPER
  $('#btnGatekeeperUseSample')?.addEventListener('click', () => {
    isGatekeeperBypassed = true;
    const sampleResponse = `### 1. Learning from Noisy & Weak Labels via Loss Correction (Patrini et al., 2017)
- Đóng góp: Đề xuất hiệu chỉnh hàm mất mát Forward/Backward dựa trên ước lượng ma trận nhiễu T.
- Phương pháp: Xây dựng ma trận chuyển dịch nhiễu kết hợp ước lượng điểm neo (anchor points).
- Điều kiện tồn tại: Ma trận chuyển đổi nhiễu (Noise Transition Matrix T) chỉ phụ thuộc vào lớp thật chứ không phụ thuộc vào đặc trưng mẫu (Instance-independent noise).
- Nguyên liệu & Dataset: Benchmark CIFAR-10, MNIST với ma trận nhiễu nhân tạo đồng nhất.
- Bằng chứng & Kết quả: Khôi phục 91% độ chính xác gốc khi tỷ lệ nhiễu nhãn dưới 40%.
- Điểm gãy: Bị sai hoàn toàn khi nhiễu nhãn phụ thuộc vào độ khó của từng mẫu cụ thể (Instance-dependent weak label noise).

### 2. Instance-Dependent Label-Noise Learning under Structural Assumptions (Berthon et al., 2021)
- Đóng góp: Bác bỏ giả định nhiễu đồng nhất và mở rộng sang nhiễu phụ thuộc đặc trưng mẫu.
- Phương pháp: Sử dụng mạng phân tách xác suất phụ thuộc đặc trưng mẫu dưới giả định tập neo.
- Điều kiện tồn tại: Có một tập neo nhỏ có độ tin cậy biết trước để tách nhiễu phụ thuộc mẫu.
- Nguyên liệu & Dataset: Dataset y tế và phân loại ảnh thực địa có nhiễu người dùng gán nhãn thực tế.
- Bằng chứng & Kết quả: Vượt qua Patrini 14.5% F1 trên dữ liệu có nhiễu phụ thuộc mẫu phức tạp.
- Điểm gãy: Tấn công trực tiếp giả định của Patrini 2017; chứng minh ma trận T cố định làm sai lệch biên quyết định trên dữ liệu thực.

### 3. LLMs as Weak Annotators: Calibration and Bias Traps (Wang et al., 2024)
- Đóng góp: Chứng minh nhãn yếu sinh bởi LLM vi phạm cả giả định độc lập của Snorkel lẫn giả định ma trận T của Patrini.
- Phương pháp: Đánh giá độ hiệu chuẩn (calibration error) và đo lường tương quan lỗi ảo giác có hệ thống.
- Điều kiện tồn tại: Dùng LLM gán nhãn yếu cho văn bản phổ thông trong phân phối.
- Nguyên liệu & Dataset: 100,000 mẫu văn bản pháp lý & y sinh gán nhãn bởi GPT-4 và Claude 3.5.
- Bằng chứng & Kết quả: Nhiễu của LLM có tính hệ thống (Systematic Hallucination), tương quan giữa các prompt lên tới 0.72.
- Điểm gãy: Tấn công cách dùng LLM làm hàm gán nhãn yếu ngây thơ vì LLM sinh ra nhiễu có hệ thống không thể khử bằng trung bình đám đông.`;

    if ($('#aiRawResponseBox')) $('#aiRawResponseBox').value = sampleResponse;
    stagedGraphData = parseRawAiOutputToGraph(sampleResponse, {
      model: 'Mẫu Học Thuật Chuẩn',
      provider: 'sample-mode',
      mode: selectedAiMode,
    });
    stagedGraphData.lineageTitle = 'Phả hệ Mẫu: Weak Label Learning & Phản Biện';
    renderStagingPreview();

    renderAiHubTab();
    setAiStep(3);
    const runEl = $('#aiStep3Running');
    if (runEl) runEl.hidden = true;
    const doneEl = $('#aiStep3Done');
    if (doneEl) doneEl.hidden = false;

    notify('⚡ Đã nạp thành công mẫu đối kháng 7 Trụ Cột Tri Thức! Bạn có thể xem bóc tách hoặc nạp ngay vào 3D.');
  });

  // 8. BƯỚC 1: TIẾP TỤC SANG BƯỚC 2 (TINH CHẾ SUPER PROMPT - PHA 1)
  $('#btnGoToStep2')?.addEventListener('click', async () => {
    const activeKey = getActiveApiKeyRecord();
    const btn = $('#btnGoToStep2');
    btn.disabled = true;
    btn.textContent = '⏳ Đang tinh chế Super Prompt...';

    const provider = activeKey?.provider || 'gemini-api';
    const model = activeKey?.model || 'gemini-3.8-flash';
    const apiKey = activeKey?.apiKey || '';

    let prompt = '';
    if (apiKey) {
      try {
        const metaPrompt = buildEpistemicMetaPrompt({
          provider,
          mode: selectedAiMode,
          phenomenon: ($('#aiTopicInput')?.value || '').trim(),
          chain: ($('#aiDecomposeChainInput')?.value || '').trim(),
          targetPaper: ($('#aiTargetPaperInput')?.value || '').trim(),
          targetCore: ($('#aiTargetCoreInput')?.value || '').trim(),
          attackReq: ($('#aiAttackInstruction')?.value || '').trim(),
        });
        const result = await callCloudLlmWithUserKey({
          provider,
          apiKey,
          model,
          prompt: metaPrompt,
        });
        prompt = result.text;
      } catch (e) {
        prompt = buildAiResearchPrompt();
      }
    } else {
      prompt = buildAiResearchPrompt();
    }

    if ($('#aiRefinedPromptBox')) $('#aiRefinedPromptBox').value = prompt;

    btn.disabled = false;
    btn.textContent = '⚡ Bước tiếp theo: Tinh chế Super Prompt (Pha 1) ➔';

    setAiStep(2);
    notify('✨ Pha 1 hoàn tất! Bấm "👁 Xem / Sửa Super Prompt" nếu muốn đọc toàn văn hoặc bấm "🚀 Khai Thác Đồ Thị" để tiếp tục.');
  });

  // 9. BƯỚC 2: QUAY LẠI BƯỚC 1
  $('#btnBackToStep1')?.addEventListener('click', () => {
    setAiStep(1);
  });

  // 10. MODAL XEM / SỬA SUPER PROMPT
  $('#btnOpenPromptModal')?.addEventListener('click', () => {
    const modal = $('#promptViewerModal');
    if (modal) modal.hidden = false;
  });

  const closePromptModal = () => {
    const modal = $('#promptViewerModal');
    if (modal) modal.hidden = true;
  };

  $('#btnClosePromptModal')?.addEventListener('click', closePromptModal);
  $('#btnClosePromptModalBtn')?.addEventListener('click', closePromptModal);
  $('#btnSavePromptModal')?.addEventListener('click', () => {
    closePromptModal();
    notify('✔ Đã lưu nội dung Super Prompt đã sửa!');
  });

  const copyPromptHandler = async () => {
    const prompt = $('#aiRefinedPromptBox')?.value || '';
    try {
      await navigator.clipboard.writeText(prompt);
      notify('📋 Đã chép Super Prompt vào Clipboard! Hãy dán vào ChatGPT / Claude / Gemini Web.');
    } catch (e) {
      notify('Không thể chép vào clipboard.');
    }
  };

  $('#btnCopyPromptModal')?.addEventListener('click', copyPromptHandler);
  $('#btnCopyPromptDirect')?.addEventListener('click', copyPromptHandler);

  // 11. BƯỚC 2: KHAI THÁC ĐỒ THỊ 3D (PHA 2)
  $('#btnExecuteAiQuery')?.addEventListener('click', async () => {
    const activeKey = getActiveApiKeyRecord();
    if (!activeKey || !activeKey.apiKey) {
      notify('⛔ Bạn cần có ít nhất 1 API Key kích hoạt để chạy tự động Pha 2. Vui lòng thêm Key trong Két Khóa.');
      openVaultModal();
      return;
    }

    let prompt = ($('#aiRefinedPromptBox')?.value || '').trim();
    if (!prompt) {
      prompt = buildAiResearchPrompt();
      if ($('#aiRefinedPromptBox')) $('#aiRefinedPromptBox').value = prompt;
    }

    setAiStep(3);
    const runEl = $('#aiStep3Running');
    const doneEl = $('#aiStep3Done');
    if (runEl) runEl.hidden = false;
    if (doneEl) doneEl.hidden = true;

    try {
      const result = await callCloudLlmWithUserKey({
        provider: activeKey.provider,
        apiKey: activeKey.apiKey,
        model: activeKey.model,
        prompt,
        jsonMode: true,
      });

      if ($('#aiRawResponseBox')) $('#aiRawResponseBox').value = result.text;
      stagedGraphData = parseRawAiOutputToGraph(result.text, {
        model: activeKey.model,
        provider: activeKey.provider,
        mode: selectedAiMode,
      });

      renderStagingPreview();

      if (runEl) runEl.hidden = true;
      if (doneEl) doneEl.hidden = false;

      const titleEl = $('#aiStep3DoneTitle');
      if (titleEl) {
        titleEl.textContent = `Đã Khai Thác Thành Công ${stagedGraphData.papers.length} Bài Báo & ${stagedGraphData.relations.length} Quan Hệ!`;
      }
      const descEl = $('#aiStep3DoneDesc');
      if (descEl) {
        descEl.textContent = `Bấm "Xem Bóc Tách" để kiểm tra 7 Trụ Cột Tri Thức hoặc bấm "Nạp Thẳng Vào Không Gian 3D" để khám phá ngay.`;
      }

      notify(`✧ Pha 2 hoàn tất! Đã trích xuất ${stagedGraphData.papers.length} bài báo (7 Trụ Cột) từ ${result.provider}.`);
    } catch (err) {
      if (runEl) runEl.hidden = true;
      setAiStep(2);
      notify('⛔ Lỗi gọi API cá nhân: ' + err.message);
    }
  });

  // 12. BƯỚC 3: MỞ / ĐÓNG MODAL XEM BÓC TÁCH (STAGING MODAL)
  $('#btnOpenStagingModal')?.addEventListener('click', () => {
    const modal = $('#stagingViewerModal');
    if (modal) modal.hidden = false;
    renderStagingPreview();
  });

  const closeStagingModal = () => {
    const modal = $('#stagingViewerModal');
    if (modal) modal.hidden = true;
  };

  $('#btnCloseStagingModal')?.addEventListener('click', closeStagingModal);
  $('#btnCloseStagingModalBtn')?.addEventListener('click', closeStagingModal);

  // 13. NẠP VÀO KHÔNG GIAN 3D
  $('#btnIngestTo3D')?.addEventListener('click', () => ingestStagedGraphTo3D(switchViewFn));
  $('#btnIngestFromModal')?.addEventListener('click', () => ingestStagedGraphTo3D(switchViewFn));

  // 14. RESET QUY TRÌNH (KHAI THÁC MỚI)
  $('#btnRestartWorkflow')?.addEventListener('click', () => {
    setAiStep(1);
    notify('Đã đặt lại quy trình. Bạn có thể nhập đề tài hoặc bài báo mới.');
  });
}

