/**
 * @file src/views/aiHubView.js
 * @description Quản lý Tab 3 ("AI & Bộ Trung Gian") theo cơ chế Cloud BYOK (Bring Your Own Key):
 * - Mỗi người dùng tự nhập API Key của riêng họ (Gemini / OpenAI / Claude API) để gọi AI, tuyệt đối không dùng chung hay tiêu tốn tài nguyên API của chủ web.
 * - Người không có API Key vẫn có thể copy Prompt chuẩn hoặc dán văn bản vào "Bộ Trung Gian Chuẩn Hóa" để nạp vào đồ thị 3D.
 * - Đã loại bỏ các kết nối Desktop cục bộ không khả dụng trên môi trường Cloud.
 */

import { ARROW_TYPES, CLOUD_LLM_PROVIDERS } from '../config/constants.js';
import {
  getState,
  saveState,
  getUserPersonalApiKey,
  saveUserPersonalApiKey,
} from '../store/workspaceStore.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { renderSidebarLineages, renderFloatingInspector } from './inspectorView.js';
import { $, escapeHTML, notify } from '../utils/dom.js';

let selectedAiProvider = 'gemini-api';
let stagedGraphData = null;

export function renderAiHubTab() {
  const state = getState();
  const ecoSelect = $('#aiTargetEcosystem');
  if (ecoSelect) {
    ecoSelect.innerHTML =
      `<option value="new">✨ Tự tạo Phả hệ mới theo vấn đề tra cứu</option>` +
      state.ecosystems.map((e) => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>`).join('');
  }
  syncProviderUiState();
}

function syncProviderUiState() {
  const dropdown = $('#aiProviderDropdown');
  if (dropdown) {
    selectedAiProvider = dropdown.value || 'gemini-api';
  }
  const cfg = CLOUD_LLM_PROVIDERS[selectedAiProvider] || CLOUD_LLM_PROVIDERS['gemini-api'];
  const hintEl = $('#aiProviderHint');
  if (hintEl) hintEl.textContent = cfg.hint;

  const isManual = selectedAiProvider === 'manual-paste';
  const apiBox = $('#apiConfigBox');
  if (apiBox) apiBox.hidden = isManual;

  const keyInput = $('#aiApiKeyInput');
  if (keyInput && !isManual) {
    keyInput.placeholder = cfg.keyPlaceholder;
    keyInput.value = getUserPersonalApiKey(selectedAiProvider);
  }

  const modelInput = $('#aiModelInput');
  if (modelInput && !isManual) {
    if (!modelInput.value || modelInput.value === 'gemini-2.5-flash') {
      modelInput.value = cfg.defaultModel;
    }
  }

  const execBtn = $('#btnExecuteAiQuery');
  if (execBtn) {
    execBtn.hidden = isManual;
  }
}

export function buildAiResearchPrompt() {
  const topic = ($('#aiTopicInput')?.value || '').trim() || 'Weak Label Learning';
  const extra = ($('#aiCustomInstruction')?.value || '').trim();
  return [
    `Bạn là chuyên gia phân tích Phả hệ Nghiên cứu Khoa học cho hệ thống đồ thị Folio 3D.`,
    `Vấn đề cần tra cứu: "${topic}"`,
    `Yêu cầu: ${extra}`,
    ``,
    `Hãy trả về kết quả theo định dạng JSON chuẩn bên dưới (hoặc văn bản có cấu trúc tương đương để Bộ Trung Gian của Folio 3D nạp thẳng vào không gian 3D):`,
    `\`\`\`json`,
    `{`,
    `  "lineageTitle": "Phả hệ: ${topic}",`,
    `  "papers": [`,
    `    {`,
    `      "tempId": "p1",`,
    `      "title": "Tên bài báo gốc (Foundation Paper)",`,
    `      "authors": "Tác giả et al.",`,
    `      "year": 2019,`,
    `      "venue": "NeurIPS/ICML/ACL",`,
    `      "coreKnowledge": "Đóng góp và tri thức cốt lõi (ngắn gọn 1-2 câu)",`,
    `      "conditions": [`,
    `        { "category": "method", "factor": "Giả định cốt lõi", "value": "Điều kiện cụ thể để bài báo này đúng" }`,
    `      ],`,
    `      "limitations": "Điểm gãy: Khi nào bài báo này bị sai hoặc thất bại?"`,
    `    }`,
    `  ],`,
    `  "relations": [`,
    `    {`,
    `      "from": "p2",`,
    `      "to": "p1",`,
    `      "type": "refute",`,
    `      "label": "TẤN CÔNG / BÁC BỎ: Chỉ ra p1 sai khi điều kiện X bị vi phạm"`,
    `    },`,
    `    {`,
    `      "from": "p1",`,
    `      "to": "p3",`,
    `      "type": "lineage",`,
    `      "label": "Kế thừa và mở rộng p1"`,
    `    }`,
    `  ]`,
    `}`,
    `\`\`\``,
  ].join('\n');
}

/**
 * Bộ Trung Gian Chuẩn Hóa (`parseRawAiOutputToGraph`):
 * Bóc tách cả JSON lẫn văn bản Markdown tự do thành danh sách Bài báo + Điều kiện + Mũi tên 3D.
 */
export function parseRawAiOutputToGraph(rawText) {
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
        return normalizeParsedObject(parsed);
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
    const coreLine = lines.find((l, i) => i > 0 && l !== condLine && l !== limitLine) || header;

    const tempId = `ai-p${idx + 1}`;
    papers.push({
      tempId,
      title: header.slice(0, 115),
      authors: `Nghiên cứu #${idx + 1}`,
      year,
      venue: 'AI Extracted',
      coreKnowledge: coreLine.replace(/^[-*•]\s*/, ''),
      conditions: [
        {
          category: 'method',
          factor: 'Điều kiện tồn tại',
          value: condLine.replace(/^[-*•]\s*(Điều kiện|Giả định)?[:\s]*/i, ''),
        },
      ],
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
      });
    }
  });

  return normalizeParsedObject({
    lineageTitle: ($('#aiTopicInput')?.value || 'Phả hệ từ AI').trim(),
    papers,
    relations,
  });
}

function normalizeParsedObject(obj) {
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

    return {
      id: newId,
      tempId: p.tempId || `p${i + 1}`,
      title: p.title || `Bài báo #${i + 1}`,
      authors: p.authors || 'AI Extracted',
      year: parseInt(p.year, 10) || 2024,
      venue: p.venue || 'Nghiên cứu',
      coreKnowledge: p.coreKnowledge || p.summary || p.title,
      conditions: conds,
      limitations: p.limitations || 'Chưa ghi điểm gãy cụ thể.',
      internalChain: [
        { stage: 'Vấn đề', text: p.title },
        { stage: 'Điều kiện', text: conds.map((c) => c.value).join('; ') },
        { stage: 'Kết luận', text: p.coreKnowledge || '' },
        { stage: 'Điểm gãy', text: p.limitations || '' },
      ],
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
    box.innerHTML = `<div class="staging-empty">Chưa có dữ liệu hợp lệ. Hãy bấm <b>"⚙ Chuẩn hóa văn bản thô"</b> hoặc <b>"⚡ Xem mẫu chuẩn hóa"</b>.</div>`;
    return;
  }

  box.innerHTML = `
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;padding:10px 12px;border-radius:8px;color:#065f46;font-size:12px;font-weight:600">
      ✔ Bộ Trung Gian đã chuẩn hóa thành công: <b>${stagedGraphData.papers.length} Bài báo</b> & <b>${
    stagedGraphData.relations.length
  } Mũi tên 3D</b> (Kế thừa / Tấn công). Bấm <b>"⚡ Nạp thẳng vào Không gian 3D"</b> ở góc trên để đưa vào đồ thị!
    </div>
    ${stagedGraphData.papers
      .map(
        (p) => `
      <div class="staged-paper-card">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#4f46e5">
          <span>[${escapeHTML(p.tempId)}] ${escapeHTML(p.authors)}</span>
          <span>Năm ${p.year}</span>
        </div>
        <div style="font-weight:800;font-size:13px;margin:2px 0 5px">${escapeHTML(p.title)}</div>
        <div style="font-size:11.5px;color:#065f46">💡 <b>Tri thức:</b> ${escapeHTML(p.coreKnowledge)}</div>
        <div style="font-size:11px;color:#92400e;margin-top:3px">
          ⚖ <b>Điều kiện tồn tại:</b> ${escapeHTML(p.conditions.map((c) => c.value).join(' | '))}
        </div>
        <div style="font-size:11px;color:#991b1b;margin-top:3px">
          ⚠ <b>Điểm gãy:</b> ${escapeHTML(p.limitations)}
        </div>
      </div>`
      )
      .join('')}
  `;
}

/**
 * Gọi trực tiếp LLM bằng API Key cá nhân của người dùng (BYOK)
 * - Hỗ trợ gọi trực tiếp từ trình duyệt (Gemini / OpenAI) hoặc qua Cloudflare Pages Function `/api/ai-proxy`.
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

export function initAiHubEvents(switchViewFn) {
  $('#aiProviderDropdown')?.addEventListener('change', () => {
    syncProviderUiState();
  });

  $('#aiApiKeyInput')?.addEventListener('change', (e) => {
    saveUserPersonalApiKey(selectedAiProvider, e.target.value);
  });

  $('#btnCopyPromptAndListen')?.addEventListener('click', async () => {
    const prompt = buildAiResearchPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
    } catch (e) {}
    notify(
      '📋 Đã chép Prompt chuẩn vào Clipboard! Bạn có thể dán vào web AI của bạn, sau đó dán câu trả lời vào ô bên phải.'
    );
  });

  $('#btnExecuteAiQuery')?.addEventListener('click', async () => {
    const apiKey = ($('#aiApiKeyInput')?.value || '').trim();
    if (!apiKey) {
      notify(
        '⛔ Bạn chưa nhập API Key cá nhân! Mỗi người dùng tự sử dụng API Key của riêng mình (hoặc tự nhập tay ở Tab 2).'
      );
      $('#aiApiKeyInput')?.focus();
      return;
    }

    saveUserPersonalApiKey(selectedAiProvider, apiKey);
    const prompt = buildAiResearchPrompt();
    const model = ($('#aiModelInput')?.value || '').trim();
    const btn = $('#btnExecuteAiQuery');
    btn.disabled = true;
    btn.textContent = '⏳ Đang gọi API cá nhân của bạn...';

    try {
      const result = await callCloudLlmWithUserKey({
        provider: selectedAiProvider,
        apiKey,
        model,
        prompt,
      });
      $('#aiRawResponseBox').value = result.text;
      stagedGraphData = parseRawAiOutputToGraph(result.text);
      renderStagingPreview();
      notify(`✧ Đã nhận kết quả từ ${result.provider} (Key cá nhân) và chuẩn hóa qua Bộ Trung Gian!`);
    } catch (err) {
      notify('⛔ Lỗi gọi API: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Gọi AI bằng API Key cá nhân';
    }
  });

  $('#btnSimulateClaudeWeakLabel')?.addEventListener('click', () => {
    const topic = ($('#aiTopicInput')?.value || 'Weak Label').trim();
    const sampleResponse = `### 1. Learning from Noisy & Weak Labels via Loss Correction (Patrini et al., 2017)
- Điều kiện tồn tại: Ma trận chuyển đổi nhiễu (Noise Transition Matrix T) chỉ phụ thuộc vào lớp thật chứ không phụ thuộc vào đặc trưng mẫu (Instance-independent noise).
- Điểm gãy: Bị sai hoàn toàn khi nhiễu nhãn phụ thuộc vào độ khó của từng mẫu cụ thể (Instance-dependent weak label noise).
- Tri thức cốt lõi: Đề xuất hiệu chỉnh hàm mất mát Forward/Backward dựa trên ước lượng ma trận nhiễu T.

### 2. Instance-Dependent Label-Noise Learning under Structural Assumptions (Berthon et al., 2021)
- Điều kiện tồn tại: Có một tập neo nhỏ có độ tin cậy biết trước để tách nhiễu phụ thuộc mẫu.
- Điểm gãy: Tấn công trực tiếp giả định của Patrini 2017; chứng minh ma trận T cố định làm sai lệch biên quyết định trên dữ liệu thực.
- Tri thức cốt lõi: Bác bỏ giả định nhiễu đồng nhất và mở rộng sang nhiễu phụ thuộc đặc trưng mẫu.

### 3. LLMs as Weak Annotators: Calibration and Bias Traps (Wang et al., 2024)
- Điều kiện tồn tại: Dùng LLM gán nhãn yếu cho văn bản phổ thông trong phân phối.
- Điểm gãy: Tấn công cách dùng LLM làm hàm gán nhãn yếu ngây thơ vì LLM sinh ra nhiễu có hệ thống (Systematic Hallucination Noise) không thể khử bằng trung bình đám đông.
- Tri thức cốt lõi: Chứng minh nhãn yếu sinh bởi LLM vi phạm cả giả định độc lập của Snorkel lẫn giả định ma trận T của Patrini.`;

    $('#aiRawResponseBox').value = sampleResponse;
    stagedGraphData = parseRawAiOutputToGraph(sampleResponse);
    stagedGraphData.lineageTitle = `Phả hệ AI: ${topic}`;
    renderStagingPreview();
    notify('⚡ Bộ Trung Gian đã bóc tách văn bản mẫu thành 3 Bài báo, Điều kiện & Mũi tên Tấn công!');
  });

  $('#btnParseRawToGraph')?.addEventListener('click', () => {
    const raw = $('#aiRawResponseBox').value;
    stagedGraphData = parseRawAiOutputToGraph(raw);
    renderStagingPreview();
    notify('⚙ Đã chuẩn hóa văn bản thô sang cấu trúc Đồ thị 3D!');
  });

  $('#btnIngestTo3D')?.addEventListener('click', () => {
    const state = getState();
    if (!stagedGraphData || !stagedGraphData.papers.length) {
      const raw = $('#aiRawResponseBox').value;
      stagedGraphData = parseRawAiOutputToGraph(raw);
    }
    if (!stagedGraphData || !stagedGraphData.papers.length) {
      notify('Chưa có dữ liệu hợp lệ trong Bộ Trung Gian để nạp.');
      return;
    }

    let targetEcoId = $('#aiTargetEcosystem')?.value;
    if (!targetEcoId || targetEcoId === 'new') {
      const palette = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b'];
      targetEcoId = `eco-${crypto.randomUUID().slice(0, 6)}`;
      state.ecosystems.push({
        id: targetEcoId,
        title: stagedGraphData.lineageTitle || `Phả hệ: ${$('#aiTopicInput').value.trim()}`,
        description: 'Phả hệ được bóc tách và tái tổ hợp qua Bộ Trung Gian AI.',
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
    sceneState.activeNodeId = stagedGraphData.papers[0].id;
    saveState();
    if (typeof switchViewFn === 'function') switchViewFn('explore');
    renderSidebarLineages(switchViewFn);
    buildSceneGraph();
    fitCameraToVisibleScene();
    renderFloatingInspector();
    notify(`⚡ Đã nạp ${stagedGraphData.papers.length} bài báo vào Không gian 3D riêng của bạn!`);
  });
}
