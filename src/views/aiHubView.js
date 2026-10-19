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
      `YÊU CẦU TINH CHẾ SUPER PROMPT:`,
      `1. Tinh chỉnh các bước suy luận thành các câu hỏi học thuật nghiêm ngặt (Phenomenological & Epistemic Deconstruction).`,
      `2. Yêu cầu mô hình tra cứu văn hiến bình duyệt thực tế (NeurIPS, ICML, ICLR, ACL, KDD, Nature, IEEE) chứng minh hoặc phản biện chuỗi này.`,
      `3. Bắt buộc mô hình trích xuất đầy đủ 7 TRỤ CỘT TRI THỨC KHOA HỌC:`,
      `   - Trụ cột 1: Đóng góp & Tuyên bố cốt lõi (coreKnowledge)`,
      `   - Trụ cột 2: Quá trình xây dựng phương pháp luận (methodPipeline)`,
      `   - Trụ cột 3: Điều kiện bắt buộc tồn tại (conditions: category, factor, value)`,
      `   - Trụ cột 4: Nguyên liệu, tập dữ liệu & quy mô thực nghiệm (materials)`,
      `   - Trụ cột 5: Bằng chứng thực nghiệm & kết quả (evidence)`,
      `   - Trụ cột 6: Điểm gãy suy luận & giới hạn sụp đổ khi bị tấn công (limitations)`,
      `   - Trụ cột 7: Mối quan hệ phả hệ biện chứng (relations: refute, lineage, support, conflict)`,
      `4. Chỉ ra ít nhất 1 Khe hở nghiên cứu (Research Gap ◇) còn bỏ ngỏ.`,
      `5. Cấu trúc output dưới dạng JSON chuẩn.`,
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
    `YÊU CẦU TINH CHẾ SUPER PROMPT:`,
    `1. Yêu cầu mô hình định vị chính xác bài báo gốc cùng các giả định biên và điểm yếu chí mạng của nó.`,
    `2. Yêu cầu mô hình tìm các bài báo hậu bối củng cố/kế thừa (Defense/Lineage) và các bài báo TẤN CÔNG / BÁC BỎ TRỰC DIỆN (Attacker/Refutation) chỉ ra điều kiện cụ thể làm sụp đổ phương pháp của bài gốc.`,
    `3. Trích xuất đầy đủ 7 TRỤ CỘT TRI THỨC KHOA HỌC cho mỗi bài báo (Đóng góp, Phương pháp, Điều kiện, Nguyên liệu, Bằng chứng, Điểm gãy, Liên kết phả hệ).`,
    `4. Đánh giá xem lỗ hổng của bài gốc đã có bài con nào trong phả hệ giải quyết chưa.`,
    `5. Định dạng JSON chuẩn.`,
    ``,
    `HÃY TRẢ VỀ DUY NHẤT TOÀN VĂN NỘI DUNG "SUPER PROMPT" ĐÃ TINH CHẾ. KHÔNG THÊM LỜI CHÀO HỎI HOẶC GIẢI THÍCH DƯ THỪA.`,
  ].join('\n');
}

export function buildAiResearchPrompt() {
  const mode = selectedAiMode;
  const provider = selectedAiProvider;

  // =========================================================================
  // CHẾ ĐỘ 1: PHÂN RÃ HIỆN TƯỢNG ĐẾN CÂU HỎI NGHIÊN CỨU
  // =========================================================================
  if (mode === 'decompose') {
    const phenomenon = ($('#aiTopicInput')?.value || '').trim() || 'Hiện tượng nghiên cứu';
    const chain = ($('#aiDecomposeChainInput')?.value || '').trim() || 'Chuỗi phân rã suy luận';

    // 1.1 Tối ưu cho Anthropic Claude (XML Tags + Phản biện Logic Sâu)
    if (provider === 'claude-api') {
      return [
        `<system_role>`,
        `Bạn là một nhà khoa học nghiên cứu cấp cao (Senior Research Epistemologist) và chuyên gia phân tích Phả hệ Khoa học cho hệ thống đồ thị tri thức Filio3D.`,
        `Nhiệm vụ: Đối chiếu chuỗi phân rã hiện tượng của người dùng với văn hiến học thuật thực tế (NeurIPS, ICML, ICLR, ACL, KDD, Nature, IEEE), tìm các bài báo chứng minh hoặc phản biện từng mắt xích, bóc tách theo 7 TRỤ CỘT TRI THỨC KHOA HỌC, và chỉ ra Khe hở nghiên cứu (Research Gap).`,
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
        `1. Tìm 3-4 bài báo khoa học thực tế (Peer-reviewed) tương ứng với từng bước trong chuỗi phân rã:`,
        `   - Bài báo gốc đặt nền móng cho hiện tượng hoặc giả thuyết (Foundation).`,
        `   - Bài báo phát triển / củng cố phương pháp giải pháp (Defense / Extension).`,
        `   - Bài báo TẤN CÔNG / BÁC BỎ (Attacker / Refutation) chỉ ra điều kiện giả thuyết bị sai lầm hoặc sụp đổ (Break-point).`,
        `2. Bóc tách nghiêm ngặt THEO 7 TRỤ CỘT TRI THỨC KHOA HỌC:`,
        `   - Trụ cột 1: Đóng góp & Phát hiện cốt lõi (coreKnowledge).`,
        `   - Trụ cột 2: Quá trình xây dựng phương pháp luận (methodPipeline).`,
        `   - Trụ cột 3: Điều kiện bắt buộc để bài báo đúng (conditions: category, factor, value).`,
        `   - Trụ cột 4: Nguyên liệu, tập dữ liệu & quy mô thực nghiệm (materials).`,
        `   - Trụ cột 5: Bằng chứng thực nghiệm & kết quả (evidence).`,
        `   - Trụ cột 6: Điểm gãy / Khi nào bài báo sụp đổ (limitations).`,
        `   - Trụ cột 7: Mũi tên liên kết 3D: refute (đỏ), conflict (cam), lineage (tím), support (xanh).`,
        `3. Chỉ ra ít nhất 1 Khe hở nghiên cứu (Research Gap ◇) chưa được giải quyết giữa các bài báo.`,
        `</epistemic_instructions>`,
        ``,
        `<output_format>`,
        `Trả về DUY NHẤT một khối JSON hợp lệ theo cấu trúc sau:`,
        `\`\`\`json`,
        `{`,
        `  "lineageTitle": "Phả hệ: ${phenomenon}",`,
        `  "papers": [`,
        `    {`,
        `      "tempId": "p1",`,
        `      "title": "Tên bài báo khoa học chính xác",`,
        `      "authors": "Tác giả et al.",`,
        `      "year": 2022,`,
        `      "venue": "NeurIPS/ICML/ICLR/ACL/Nature",`,
        `      "coreKnowledge": "Trụ cột 1: Đóng góp và phát hiện cốt lõi",`,
        `      "methodPipeline": "Trụ cột 2: Từng bước phương pháp luận từ vấn đề đến giải pháp",`,
        `      "conditions": [`,
        `        { "category": "method", "factor": "Giả định", "value": "Trụ cột 3: Điều kiện cụ thể để bài báo đúng" }`,
        `      ],`,
        `      "materials": "Trụ cột 4: Tập dữ liệu, quy mô tham số, benchmark thực nghiệm",`,
        `      "evidence": "Trụ cột 5: Kết quả thực nghiệm và số liệu đo lường cụ thể",`,
        `      "limitations": "Trụ cột 6: Điểm gãy - Khi nào bài báo này thất bại?"`,
        `    }`,
        `  ],`,
        `  "relations": [`,
        `    { "from": "p2", "to": "p1", "type": "refute", "label": "Tấn công / Chỉ ra điểm gãy của p1", "conditionNote": "Điều kiện gây sụp đổ" },`,
        `    { "from": "p1", "to": "p3", "type": "lineage", "label": "Kế thừa và mở rộng p1", "conditionNote": "Mở rộng giả thiết" }`,
        `  ]`,
        `}`,
        `\`\`\``,
        `</output_format>`,
      ].join('\n');
    }

    // 1.2 Tối ưu cho Google Gemini (Grounded Literature + Direct Fact Extraction)
    if (provider === 'gemini-api') {
      return [
        `Bạn là chuyên gia phân tích Phả hệ Nghiên cứu Khoa học của hệ thống Filio3D.`,
        `Hãy đối chiếu các luận điểm nghiên cứu và chuỗi phân rã suy luận sau đây với văn hiến học thuật thực tế:`,
        ``,
        `HIỆN TƯỢNG / VẤN ĐỀ: "${phenomenon}"`,
        `CHUỖI PHÂN RÃ SUY LUẬN & GIẢ THUYẾT:`,
        chain,
        ``,
        `YÊU CẦU TRÍCH XUẤT HỌC THUẬT (7 TRỤ CỘT TRI THỨC):`,
        `1. Tìm 3-4 bài báo khoa học thực tế (có tác giả, năm, hội nghị uy tín: NeurIPS, ICML, ICLR, ACL, KDD, Nature, IEEE).`,
        `2. Bóc tách mỗi bài báo đầy đủ 7 Trụ Cột:`,
        `   - Trụ cột 1: Đóng góp & phát hiện cốt lõi (coreKnowledge).`,
        `   - Trụ cột 2: Quá trình xây dựng phương pháp (methodPipeline).`,
        `   - Trụ cột 3: Điều kiện tồn tại bắt buộc để bài báo đúng (conditions: category, factor, value).`,
        `   - Trụ cột 4: Nguyên liệu, dataset & quy mô thực nghiệm (materials).`,
        `   - Trụ cột 5: Bằng chứng thực nghiệm & phát hiện (evidence).`,
        `   - Trụ cột 6: Điểm gãy sụp đổ / khi nào bài báo bị sai (limitations).`,
        `   - Trụ cột 7: Mối quan hệ phả hệ biện chứng (refute, lineage, support, conflict).`,
        `3. Chỉ ra Khe hở nghiên cứu (Research Gap ◇) còn bỏ ngỏ.`,
        ``,
        `ĐỊNH DẠNG JSON TRẢ VỀ:`,
        `\`\`\`json`,
        `{`,
        `  "lineageTitle": "Phả hệ: ${phenomenon}",`,
        `  "papers": [`,
        `    {`,
        `      "tempId": "p1",`,
        `      "title": "Tên bài báo",`,
        `      "authors": "Tác giả et al.",`,
        `      "year": 2022,`,
        `      "venue": "Hội nghị/Nguồn",`,
        `      "coreKnowledge": "Trụ cột 1: Đóng góp cốt lõi",`,
        `      "methodPipeline": "Trụ cột 2: Quy trình phương pháp luận",`,
        `      "conditions": [{ "category": "data", "factor": "Yếu tố", "value": "Trụ cột 3: Điều kiện tồn tại" }],`,
        `      "materials": "Trụ cột 4: Dataset & tài nguyên",`,
        `      "evidence": "Trụ cột 5: Kết quả thực nghiệm",`,
        `      "limitations": "Trụ cột 6: Điểm gãy"`,
        `    }`,
        `  ],`,
        `  "relations": [`,
        `    { "from": "p2", "to": "p1", "type": "refute", "label": "Tấn công / Bác bỏ", "conditionNote": "Điều kiện gây sai lệch" }`,
        `  ]`,
        `}`,
        `\`\`\``,
      ].join('\n');
    }

    // 1.3 Tối ưu cho OpenAI GPT (Developer Role + Structured Chain-of-Thought)
    return [
      `[Role: Senior AI Research Epistemologist for Filio3D Graph]`,
      `[Task: Ground user phenomenon decomposition into real scientific literature across 7 Epistemic Pillars]`,
      ``,
      `User Phenomenon: "${phenomenon}"`,
      `Decomposition Reasoning Chain:`,
      chain,
      ``,
      `Instructions:`,
      `1. Find 3-4 real peer-reviewed scientific papers addressing this reasoning chain (foundation, attacks, and defense).`,
      `2. Extract the 7 Knowledge Pillars for each paper: coreKnowledge, methodPipeline, conditions, materials, evidence, limitations, and relations.`,
      `3. Identify points of refutation: Where does the assumption break?`,
      `4. Output strictly valid JSON matching this schema:`,
      `\`\`\`json`,
      `{`,
      `  "lineageTitle": "Phả hệ: ${phenomenon}",`,
      `  "papers": [`,
      `    {`,
      `      "tempId": "p1",`,
      `      "title": "Tên bài",`,
      `      "authors": "Tác giả",`,
      `      "year": 2023,`,
      `      "venue": "NeurIPS",`,
      `      "coreKnowledge": "Trụ cột 1: Đóng góp chính",`,
      `      "methodPipeline": "Trụ cột 2: Quy trình phương pháp",`,
      `      "conditions": [{"category":"method","factor":"Giả định","value":"Trụ cột 3: Điều kiện"}],`,
      `      "materials": "Trụ cột 4: Datasets",`,
      `      "evidence": "Trụ cột 5: Bằng chứng",`,
      `      "limitations": "Trụ cột 6: Điểm gãy"`,
      `    }`,
      `  ],`,
      `  "relations": [`,
      `    { "from": "p2", "to": "p1", "type": "refute", "label": "Tấn công/Bác bỏ" }`,
      `  ]`,
      `}`,
      `\`\`\``,
    ].join('\n');
  }

  // =========================================================================
  // CHẾ ĐỘ 2: ĐƯA 1 BÀI BÁO CỤ THỂ ➔ TÌM ĐÒN TẤN CÔNG & PHÒNG THỦ
  // =========================================================================
  const targetPaper = ($('#aiTargetPaperInput')?.value || '').trim() || 'Bài báo mục tiêu';
  const targetCore = ($('#aiTargetCoreInput')?.value || '').trim() || 'Đóng góp chính';
  const attackReq = ($('#aiAttackInstruction')?.value || '').trim();

  // 2.1 Tối ưu cho Claude
  if (provider === 'claude-api') {
    return [
      `<system_role>`,
      `Bạn là chuyên gia Phản biện Học thuật (Peer-Review Critic & Epistemic Defense/Attack Analyst) cho hệ thống Filio3D.`,
      `Nhiệm vụ: Phân tích 1 bài báo mục tiêu, tìm các công trình kế thừa bảo vệ (Defense/Foundation) và các công trình TẤN CÔNG / BÁC BỎ / PHỦ ĐỊNH (Attacker/Refutation) cùng các điều kiện biên sụp đổ theo 7 TRỤ CỘT TRI THỨC.`,
      `</system_role>`,
      ``,
      `<target_paper>`,
      `<title_and_citation>${targetPaper}</title_and_citation>`,
      `<core_claim>${targetCore}</core_claim>`,
      `<inquiry_directive>${attackReq}</inquiry_directive>`,
      `</target_paper>`,
      ``,
      `<dialectical_mapping_requirements>`,
      `1. Bao gồm chính bài báo mục tiêu (tempId: "p1") với đầy đủ 7 Trụ Cột Tri Thức.`,
      `2. Tìm 2-3 bài báo khoa học thực tế xuất bản sau bài gốc:`,
      `   - Ít nhất 1 bài báo kế thừa / củng cố (Defense/Extension -> mũi tên lineage/support).`,
      `   - Ít nhất 1-2 bài báo TẤN CÔNG TRỰC DIỆN (Attacker/Refutation -> mũi tên refute): bài báo này phải chỉ ra điều kiện cụ thể mà tại đó phương pháp của p1 bị vô hiệu hóa hoặc sụp đổ!`,
      `3. Bóc tách rõ 7 Trụ Cột: coreKnowledge, methodPipeline, conditions, materials, evidence, limitations.`,
      `4. Chỉ ra khe hở nghiên cứu (Research Gap) còn tồn tại giữa bài gốc và các bài tấn công.`,
      `</dialectical_mapping_requirements>`,
      ``,
      `<output_format>`,
      `\`\`\`json`,
      `{`,
      `  "lineageTitle": "Phả hệ Tấn công & Phòng thủ: ${targetPaper.slice(0, 40)}",`,
      `  "papers": [`,
      `    {`,
      `      "tempId": "p1",`,
      `      "title": "${targetPaper}",`,
      `      "authors": "Tác giả bài gốc",`,
      `      "year": 2017,`,
      `      "venue": "Nguồn gốc",`,
      `      "coreKnowledge": "${targetCore}",`,
      `      "methodPipeline": "Trụ cột 2: Phương pháp bài gốc",`,
      `      "conditions": [{ "category": "method", "factor": "Giả định", "value": "Điều kiện cần để bài này đúng" }],`,
      `      "materials": "Trụ cột 4: Dataset bài gốc",`,
      `      "evidence": "Trụ cột 5: Kết quả bài gốc",`,
      `      "limitations": "Trụ cột 6: Điểm gãy khi bị tấn công"`,
      `    },`,
      `    {`,
      `      "tempId": "p2",`,
      `      "title": "Tên bài báo Tấn công / Bác bỏ p1",`,
      `      "authors": "Tác giả tấn công",`,
      `      "year": 2020,`,
      `      "venue": "Hội nghị uy tín",`,
      `      "coreKnowledge": "Chỉ ra p1 sai lầm khi vi phạm điều kiện X",`,
      `      "methodPipeline": "Phương pháp thiết kế đòn tấn công phản bác",`,
      `      "conditions": [{ "category": "environment", "factor": "Miền kiểm thử", "value": "Điều kiện gây sụp đổ" }],`,
      `      "materials": "Benchmark đối kháng",`,
      `      "evidence": "Tỷ lệ lỗi tăng vọt của p1 khi bị tấn công",`,
      `      "limitations": "Hạn chế của bài tấn công"`,
      `    }`,
      `  ],`,
      `  "relations": [`,
      `    { "from": "p2", "to": "p1", "type": "refute", "label": "TẤN CÔNG: Bác bỏ p1 dưới điều kiện tương quan phức tạp" }`,
      `  ]`,
      `}`,
      `\`\`\``,
      `</output_format>`,
    ].join('\n');
  }

  // 2.2 Tối ưu cho Gemini & GPT
  return [
    `Bạn là chuyên gia phân tích Đòn Tấn công & Phòng thủ Học thuật của Filio3D.`,
    `Bài báo mục tiêu: "${targetPaper}"`,
    `Đóng góp cốt lõi: "${targetCore}"`,
    `Yêu cầu: ${attackReq}`,
    ``,
    `Hãy tìm các bài báo thực tế trong văn hiến đã kế thừa (Defense) và các bài báo TẤN CÔNG / BÁC BỎ (Attacker / Refutation) bài báo này.`,
    `Bóc tách rõ 7 TRỤ CỘT TRI THỨC KHOA HỌC của từng bài báo (coreKnowledge, methodPipeline, conditions, materials, evidence, limitations).`,
    `Trả về khối JSON chuẩn:`,
    `\`\`\`json`,
    `{`,
    `  "lineageTitle": "Phả hệ Tấn công & Phòng thủ: ${targetPaper.slice(0, 40)}",`,
    `  "papers": [`,
    `    {`,
    `      "tempId": "p1",`,
    `      "title": "${targetPaper}",`,
    `      "authors": "Tác giả",`,
    `      "year": 2017,`,
    `      "venue": "Venue",`,
    `      "coreKnowledge": "${targetCore}",`,
    `      "methodPipeline": "Phương pháp",`,
    `      "conditions": [{ "category": "method", "factor": "Giả định", "value": "Điều kiện" }],`,
    `      "materials": "Datasets",`,
    `      "evidence": "Kết quả",`,
    `      "limitations": "Điểm gãy"`,
    `    }`,
    `  ],`,
    `  "relations": [`,
    `    { "from": "p2", "to": "p1", "type": "refute", "label": "Tấn công / Bác bỏ p1" }`,
    `  ]`,
    `}`,
    `\`\`\``,
  ].join('\n');
}

/**
 * Bộ Trung Gian Chuẩn Hóa (`parseRawAiOutputToGraph`):
 * Bóc tách cả JSON lẫn văn bản Markdown tự do thành 7 Trụ Cột Tri Thức Khoa Học + Mũi tên 3D.
 */
export function parseRawAiOutputToGraph(rawText, metadata = {}) {
  const text = (rawText || '').trim();
  if (!text) return null;

  const jsonFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidateJson = jsonFenceMatch ? jsonFenceMatch[1].trim() : text;
  try {
    const firstBrace = candidateJson.indexOf('{');
    const lastBrace = candidateJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const parsed = JSON.parse(candidateJson.slice(firstBrace, lastBrace + 1));
      if (Array.isArray(parsed.papers) && parsed.papers.length > 0) {
        return normalizeParsedObject(parsed, metadata);
      }
    }
  } catch (e) {}

  const blocks = text
    .split(/\n(?=#{1,4}\s|\d+\.\s+\*\*|\*\*Bài báo|\*\*Paper)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 25);

  const papers = [];
  const relations = [];

  blocks.forEach((blk, idx) => {
    const lines = blk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const header = lines[0].replace(/^[#*0-9.\-–\s]+/, '').replace(/\*+/g, '').trim();
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
    const coreLine = lines.find((l, i) => i > 0 && l !== condLine && l !== limitLine && l !== methodLine && l !== matLine && l !== evLine) || header;

    const tempId = `ai-p${idx + 1}`;
    papers.push({
      tempId,
      title: header.slice(0, 115),
      authors: `Nghiên cứu #${idx + 1}`,
      year,
      venue: 'AI Extracted',
      coreKnowledge: coreLine.replace(/^[-*•]\s*(Tri thức|Đóng góp)?[:\s]*/i, ''),
      methodPipeline: methodLine.replace(/^[-*•]\s*(Phương pháp|Quy trình)?[:\s]*/i, ''),
      conditions: [
        {
          category: 'method',
          factor: 'Điều kiện tồn tại',
          value: condLine.replace(/^[-*•]\s*(Điều kiện|Giả định)?[:\s]*/i, ''),
        },
      ],
      materials: matLine.replace(/^[-*•]\s*(Nguyên liệu|Dataset)?[:\s]*/i, ''),
      evidence: evLine.replace(/^[-*•]\s*(Bằng chứng|Kết quả)?[:\s]*/i, ''),
      limitations: limitLine.replace(/^[-*•]\s*(Điểm gãy|Giới hạn)?[:\s]*/i, ''),
    });

    if (idx > 0) {
      const isAttack = /(tấn công|bác bỏ|phản bác|sụp đổ|mâu thuẫn|attack|refute|fail)/i.test(blk);
      relations.push({
        from: isAttack ? tempId : `ai-p${idx}`,
        to: isAttack ? `ai-p${idx}` : tempId,
        type: isAttack ? 'refute' : 'lineage',
        label: isAttack
          ? `Tấn công / Chỉ ra điểm gãy của bài trước (${year})`
          : `Kế thừa và phát triển tiếp phả hệ (${year})`,
        conditionNote: isAttack ? 'Tấn công làm sụp đổ giả định' : 'Mở rộng phả hệ',
      });
    }
  });

  return normalizeParsedObject(
    {
      lineageTitle: ($('#aiTopicInput')?.value || 'Phả hệ từ AI').trim(),
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
    const conds = Array.isArray(p.conditions)
      ? p.conditions.map((c) =>
          typeof c === 'string'
            ? { category: 'method', factor: 'Điều kiện', value: c }
            : {
                category: c.category || 'method',
                factor: c.factor || 'Điều kiện',
                value: c.value || '',
              }
        )
      : [{ category: 'method', factor: 'Điều kiện', value: String(p.conditions || 'Theo giả định bài báo') }];

    const internalChain = Array.isArray(p.internalChain) && p.internalChain.length
      ? p.internalChain
      : [
          { stage: 'Vấn đề', text: p.title || '' },
          { stage: 'Điều kiện', text: conds.map((c) => c.value).join('; ') },
          { stage: 'Phương pháp', text: p.methodPipeline || 'Xây dựng mô hình & quy trình giải pháp' },
          { stage: 'Kết luận', text: p.coreKnowledge || '' },
        ];

    return {
      id: newId,
      tempId: p.tempId || `p${i + 1}`,
      title: p.title || `Bài báo #${i + 1}`,
      authors: p.authors || 'AI Extracted',
      year: parseInt(p.year, 10) || 2024,
      venue: p.venue || 'Nghiên cứu',
      provenance: p.provenance || {
        type: 'ai',
        model: metadata.model || 'Gemini 3.8 Flash',
        provider: metadata.provider || selectedAiProvider,
        mode: metadata.mode || selectedAiMode,
        timestamp: Date.now(),
      },
      // 7 TRỤ CỘT TRI THỨC KHOA HỌC
      coreKnowledge: p.coreKnowledge || p.summary || p.title,
      methodPipeline: p.methodPipeline || p.methodology || internalChain.map((s) => `${s.stage}: ${s.text}`).join(' -> '),
      conditions: conds,
      materials: p.materials || p.datasets || 'Tập dữ liệu và tài nguyên thực nghiệm chuẩn.',
      evidence: p.evidence || p.findings || 'Đã kiểm chứng kết quả thực nghiệm trên các tác vụ đo lường.',
      limitations: p.limitations || 'Chưa ghi điểm gãy cụ thể.',
      internalChain,
    };
  });

  const cleanRelations = (obj.relations || [])
    .map((r) => ({
      id: `rel-ai-${crypto.randomUUID().slice(0, 6)}`,
      from: idMap.get(r.from) || cleanPapers[0]?.id,
      to: idMap.get(r.to) || cleanPapers[1]?.id,
      type: ARROW_TYPES[r.type] ? r.type : 'lineage',
      label: r.label || 'Liên kết phả hệ',
      conditionNote: r.conditionNote || r.label || '',
    }))
    .filter((r) => r.from && r.to && r.from !== r.to);

  return {
    lineageTitle: obj.lineageTitle || 'Phả hệ AI bóc tách',
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
 */
async function callCloudLlmWithUserKey({ provider, apiKey, model, prompt }) {
  // 1. Gọi trực tiếp Google Gemini API từ trình duyệt bằng Key của người dùng
  if (provider === 'gemini-api') {
    let cleanModel = (model || 'gemini-3.8-flash').trim();
    if (cleanModel === 'gemini-2.5-flash') {
      cleanModel = 'gemini-3.8-flash';
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
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
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
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
    body: JSON.stringify({ provider, apiKey, model, prompt }),
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

