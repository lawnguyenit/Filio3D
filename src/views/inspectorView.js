/**
 * @file src/views/inspectorView.js
 * @description Quản lý Ngăn Chi tiết Nút 3D (Floating Right Inspector), Danh sách Phả hệ ở Sidebar,
 * và Popover Câu hỏi / Chuỗi suy luận 3D.
 */

import { ARROW_TYPES } from '../config/constants.js';
import { getState, saveState } from '../store/workspaceStore.js';
import { promoteGapToQuestion } from '../engine/gapEngine.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { $, $$, escapeHTML, shortAuthor, notify } from '../utils/dom.js';

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (e) {
    return '';
  }
}

export function renderFloatingInspector() {
  const state = getState();
  const body = $('#inspectorBody');
  const tag = $('#inspectorHeaderTag');
  if (!body) return;

  const node = sceneState.sceneNodes.find((n) => n.id === sceneState.activeNodeId) || sceneState.sceneNodes[0];
  if (!node) {
    body.innerHTML = `<div style="color:#94a3b8;padding:12px 0">Click vào một nút trên không gian 3D để xem Tri thức cốt lõi, Điều kiện tồn tại và các bài Tấn công/Kế thừa.</div>`;
    return;
  }

  if (node.type === 'paper' || node.type === 'micro') {
    const paper = node.type === 'micro' ? node.raw.paper : node.raw;
    const isIsolated = sceneState.isolatedFocusNodeId === paper.id;
    const relatedLinks = state.relations.filter((r) => r.from === paper.id || r.to === paper.id);

    // 1. XUẤT XỨ TRI THỨC (KNOWLEDGE PROVENANCE)
    const prov = paper.provenance || { type: 'system', origin: 'Mẫu chuẩn hệ thống' };
    let provBadgeHtml = '';
    if (prov.type === 'ai') {
      provBadgeHtml = `<span class="provenance-badge prov-ai" title="Bóc tách tự động bởi mô hình ${escapeHTML(prov.model || 'AI')}">🤖 ${escapeHTML(prov.model || 'Gemini 3.8')} Bóc Tách</span>`;
    } else if (prov.type === 'manual') {
      provBadgeHtml = `<span class="provenance-badge prov-manual" title="Do nhà nghiên cứu tự nhập tay">✍ Người dùng tự nhập</span>`;
    } else {
      provBadgeHtml = `<span class="provenance-badge prov-system" title="Dữ liệu chuẩn học thuật">🏛 Mẫu chuẩn hệ thống</span>`;
    }

    tag.className = 'node-type-badge badge-paper';
    tag.innerHTML = `<span>BÀI BÁO · ${paper.year}</span> ${provBadgeHtml}`;
    const paperUrl = safeExternalUrl(paper.url);
    const paperEvidenceHtml = (paper.sourceEvidence || []).map((item) => {
      const url = safeExternalUrl(item.url);
      if (!item.quote && !url) return '';
      return `<li>${escapeHTML(item.quote || 'Không có trích đoạn')} ${item.pageOrSection ? `<span>(${escapeHTML(item.pageOrSection)})</span>` : ''} ${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a>` : ''}</li>`;
    }).filter(Boolean).join('');

    // 2. PHÂN TÍCH PHẢ HỆ BIỆN CHỨNG (DIALECTIC LINEAGE ANALYSIS)
    const incomingRefutes = relatedLinks.filter((r) => r.to === paper.id && (r.type === 'refute' || r.type === 'conflict'));
    const outgoingRefutes = relatedLinks.filter((r) => r.from === paper.id && (r.type === 'refute' || r.type === 'conflict'));
    const descendants = relatedLinks.filter((r) => r.from === paper.id && r.type === 'lineage');
    const ancestors = relatedLinks.filter((r) => (r.to === paper.id && r.type === 'lineage') || (r.from === paper.id && r.type === 'support'));

    // Kiểm tra xem điểm gãy của bài báo này đã được bài con nào trong phả hệ khắc phục chưa
    let gapResolutionBanner = '';
    if (incomingRefutes.length > 0) {
      // Tìm bài kế thừa có quan hệ support hoặc lineage giải quyết điểm gãy
      const resolverRel = state.relations.find((r) =>
        r.type === 'support' && incomingRefutes.some((atk) => atk.from === r.to)
      );
      if (resolverRel) {
        const resolverPaper = state.sources.find((s) => s.id === resolverRel.from);
        gapResolutionBanner = `
          <div class="lineage-resolution-alert resolved">
            🛡️ <b>Đồ thị có một quan hệ hỗ trợ:</b> <b>"${escapeHTML(resolverPaper?.title || resolverRel.from)}"</b> được liên kết như công trình hỗ trợ. Hãy kiểm tra nguồn và điều kiện trước khi xem điểm gãy là đã được giải quyết.
          </div>`;
      } else if (descendants.length > 0) {
        gapResolutionBanner = `
          <div class="lineage-resolution-alert in-progress">
            🌿 <b>Có quan hệ kế thừa trong đồ thị:</b> Bài báo có ${descendants.length} công trình được liên kết. Quan hệ và nguồn vẫn cần được kiểm tra.
          </div>`;
      } else {
        gapResolutionBanner = `
          <div class="lineage-resolution-alert unresolved">
            ⚡ <b>Ứng viên khe hở:</b> Đồ thị hiện tại có quan hệ bác bỏ nhưng chưa ghi nhận quan hệ kế thừa nào xử lý điểm này. Điều đó chưa chứng minh rằng văn liệu bên ngoài đồ thị chưa giải quyết nó.
          </div>`;
      }
    } else {
      gapResolutionBanner = `
        <div class="lineage-resolution-alert stable">
          ✓ <b>Chưa thấy phản biện trong tập hiện tại:</b> Đồ thị chưa ghi nhận quan hệ bác bỏ cho bài này; điều đó không xác nhận giả định đã ổn định.
        </div>`;
    }

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <h3 class="insp-title" style="flex:1;margin-bottom:2px">${escapeHTML(paper.title)}</h3>
      </div>
      <p class="insp-meta">${escapeHTML(paper.authors)} · <b>${escapeHTML(paper.venue)} (${paper.year})</b></p>
      ${paper.sourceStatus === 'unverified' ? '<p class="source-review-notice">Nguồn do model nêu chưa được xác minh độc lập.</p>' : ''}
      ${paperUrl ? `<p class="insp-meta"><a href="${escapeHTML(paperUrl)}" target="_blank" rel="noopener noreferrer">Mở trang bài báo ↗</a></p>` : ''}
      ${paperEvidenceHtml ? `<details class="inspector-source-evidence"><summary>Trích đoạn nguồn (${(paper.sourceEvidence || []).length})</summary><ul>${paperEvidenceHtml}</ul></details>` : ''}

      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button class="hud-btn highlight-btn ${isIsolated ? 'active' : ''}" id="btnInspectorIsolate" style="flex:1">
          ${isIsolated ? '✓ Đang cô lập nhánh này (Bấm để mở rộng)' : '🎯 Chỉ hiện Phả hệ & Bài tấn công bài này'}
        </button>
      </div>

      <!-- TRỤ CỘT 1: ĐÓNG GÓP & TUYÊN BỐ CỐT LÕI -->
      <div class="insp-card insp-core">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 1</span> · 💡 ĐÓNG GÓP & TUYÊN BỐ CỐT LÕI</div>
        <div class="pillar-body">${escapeHTML(paper.coreKnowledge || 'Chưa có trong dữ liệu này.')}</div>
      </div>

      <!-- TRỤ CỘT 2: QUÁ TRÌNH XÂY DỰNG GIẢI PHÁP -->
      <div class="insp-card insp-method">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 2</span> · 🔬 PHƯƠNG PHÁP LUẬN & QUÁ TRÌNH XÂY DỰNG</div>
        <div class="pillar-body">
          ${paper.methodPipeline ? `<div style="margin-bottom:6px;line-height:1.4">${escapeHTML(paper.methodPipeline)}</div>` : ''}
          ${(paper.internalChain || []).length ? `
            <div class="method-pipeline-list">
              ${paper.internalChain.map((step, idx) => `
                <div class="pipeline-step-row">
                  <span class="step-badge">${idx + 1}</span>
                  <div class="step-text"><b>${escapeHTML(step.stage || `Bước ${idx + 1}`)}:</b> ${escapeHTML(step.text)}</div>
                </div>
              `).join('')}
            </div>
          ` : (!paper.methodPipeline ? '<div style="color:#94a3b8">Chưa ghi quy trình phương pháp cụ thể.</div>' : '')}
        </div>
      </div>

      <!-- TRỤ CỘT 3: ĐIỀU KIỆN TỒN TẠI -->
      <div class="insp-card insp-cond">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 3</span> · ⚖️ ĐIỀU KIỆN BẮT BUỘC ĐỂ ĐÚNG (CONDITIONS)</div>
        <div class="pillar-body">
          ${
            (paper.conditions || []).length
              ? paper.conditions
                  .map((c) => `
                    <div class="condition-chip-row">
                      <span class="cond-type-pill pill-${c.category || 'method'}">${escapeHTML(c.category || 'method')}</span>
                      <span class="cond-text"><b>${escapeHTML(c.factor)}:</b> ${escapeHTML(c.value)}</span>
                    </div>`)
                  .join('')
              : '<div style="color:#94a3b8">Chưa ghi điều kiện biên cụ thể.</div>'
          }
        </div>
      </div>

      <!-- TRỤ CỘT 4: NGUYÊN LIỆU & QUY MÔ THỰC NGHIỆM -->
      <div class="insp-card insp-materials">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 4</span> · 📦 NGUYÊN LIỆU, TÀI NGUYÊN & QUY MÔ</div>
        <div class="pillar-body">${escapeHTML(paper.materials || 'Chưa có trong dữ liệu này.')}</div>
      </div>

      <!-- TRỤ CỘT 5: BẰNG CHỨNG THỰC NGHIỆM & KẾT QUẢ -->
      <div class="insp-card insp-evidence">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 5</span> · 📊 BẰNG CHỨNG THỰC NGHIỆM & PHÁT HIỆN</div>
        <div class="pillar-body">${escapeHTML(paper.evidence || 'Chưa có trong dữ liệu này.')}</div>
      </div>

      <!-- TRỤ CỘT 6: ĐIỂM GÃY SUY LUẬN & GIỚI HẠN TIỀM ẨN -->
      <div class="insp-card insp-limit">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 6</span> · ⚠️ ĐIỂM GÃY SUY LUẬN & ĐIỀU KIỆN SỤP ĐỔ</div>
        <div class="pillar-body">${escapeHTML(paper.limitations || 'Chưa ghi điểm gãy cụ thể.')}</div>
      </div>

      <!-- TRỤ CỘT 7: VỊ TRÍ PHẢ HỆ & ĐÁNH GIÁ LỖ HỔNG -->
      <div class="insp-card insp-lineage">
        <div class="insp-card-head"><span class="pillar-tag">TRỤ CỘT 7</span> · 🧬 VỊ TRÍ PHẢ HỆ BIỆN CHỨNG & ĐÁNH GIÁ LỖ HỔNG</div>
        
        ${gapResolutionBanner}

        <div style="font-size:10px;font-weight:800;color:#cbd5e1;letter-spacing:0.5px;margin:8px 0 4px">
          MỐI LIÊN KẾT TRỰC TIẾP (${relatedLinks.length}):
        </div>
        ${relatedLinks.length === 0 ? '<div style="color:#94a3b8;font-size:11px">Chưa có liên kết với bài báo khác trong phả hệ.</div>' : ''}
        ${relatedLinks
          .map((rel) => {
            const isOut = rel.from === paper.id;
            const otherId = isOut ? rel.to : rel.from;
            const other = state.sources.find((s) => s.id === otherId);
            const st = ARROW_TYPES[rel.type] || ARROW_TYPES.support;
            const relEvidenceHtml = (rel.sourceEvidence || []).map((item) => {
              const url = safeExternalUrl(item.url);
              return item.quote && url
                ? `<li>${escapeHTML(item.quote)} <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a></li>`
                : '';
            }).filter(Boolean).join('');
            let roleLabel = '';
            if (rel.type === 'refute' || rel.type === 'conflict') {
              roleLabel = isOut ? '⚔️ TẤN CÔNG BÁC BỎ:' : '⚡ BỊ TẤN CÔNG BỞI:';
            } else if (rel.type === 'lineage') {
              roleLabel = isOut ? '🌿 KẾ THỪA / PHÁT TRIỂN TIẾP:' : '🏛️ XUẤT PHÁT TỪ NỀN MÓNG:';
            } else {
              roleLabel = isOut ? '🛡️ CỦNG CỐ / GIẢI QUYẾT:' : '🛡️ ĐƯỢC CỦNG CỐ BỞI:';
            }

            return `
              <div class="insp-rel-item" data-insp-jump="${escapeHTML(otherId)}">
                <span class="rel-badge rel-${rel.type}">${st.short}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:11px;color:#fff">
                    ${roleLabel} ${escapeHTML(other?.title || otherId)}
                  </div>
                  <div style="font-size:10px;color:#94a3b8">${escapeHTML(rel.label)}</div>
                  ${relEvidenceHtml ? `<details class="inspector-source-evidence"><summary>Nguồn của quan hệ</summary><ul>${relEvidenceHtml}</ul></details>` : ''}
                </div>
              </div>`;
          })
          .join('')}
      </div>
    `;

    $('#btnInspectorIsolate', body)?.addEventListener('click', () => {
      sceneState.isolatedFocusNodeId = isIsolated ? null : paper.id;
      buildSceneGraph();
      fitCameraToVisibleScene();
      renderFloatingInspector();
    });

    $$('[data-insp-jump]', body).forEach((el) =>
      el.addEventListener('click', (event) => {
        if (event.target.closest('a, summary')) return;
        sceneState.activeNodeId = el.dataset.inspJump;
        if (sceneState.isolatedFocusNodeId && !sceneState.sceneNodes.some((n) => n.id === sceneState.activeNodeId)) {
          sceneState.isolatedFocusNodeId = sceneState.activeNodeId;
          buildSceneGraph();
        }
        renderFloatingInspector();
      })
    );
    return;
  }

  if (node.type === 'gap') {
    const gap = node.raw;
    tag.className = 'node-type-badge badge-gap';
    tag.innerHTML = `<span>◇ ỨNG VIÊN KHE HỞ</span> <span class="provenance-badge prov-algo">◇ Quét Thuật Toán Đồ Thị</span>`;
    body.innerHTML = `
      <h3 class="insp-title">${escapeHTML(gap.title)}</h3>
      <p class="insp-meta">${escapeHTML(gap.kind)}</p>

      <div class="insp-card insp-algo-prov">
        <div class="insp-card-head" style="color:#60a5fa">🔍 XUẤT XỨ & CƠ CHẾ PHÁT HIỆN</div>
        <div>Ứng viên này được tạo từ quan hệ tương khắc (conflict) hoặc bác bỏ (refute) trong đồ thị hiện tại. Hãy kiểm tra bài báo, trích dẫn và phạm vi văn liệu; đây chưa phải bằng chứng rằng khoảng trống thực sự tồn tại.</div>
      </div>

      <div class="insp-card insp-limit">
        <div class="insp-card-head" style="color:#f9a8d4">🔍 TÍN HIỆU TỪ ĐỒ THỊ</div>
        <div>${escapeHTML(gap.summary)}</div>
      </div>
      <div class="insp-card insp-cond">
        <div class="insp-card-head" style="color:#fcd34d">⚖️ ĐIỀU KIỆN CẦN KIỂM TRA</div>
        <div>${escapeHTML(gap.missingCondition)}</div>
      </div>
      <div class="insp-card insp-core">
        <div class="insp-card-head" style="color:#6ee7b7">✦ CÂU HỎI NGHIÊN CỨU ĐỀ XUẤT</div>
        <div style="font-weight:700;margin-bottom:8px">"${escapeHTML(gap.suggestedQuestion)}"</div>
        <button class="primary-button" id="btnPromoteGap3D" style="width:100%">
          ✦ Dùng làm Câu hỏi nghiên cứu mới
        </button>
      </div>
    `;
    $('#btnPromoteGap3D', body)?.addEventListener('click', () => {
      promoteGapToQuestion(gap, () => {
        sceneState.showReasoning3D = true;
        $('#btnToggleReasoning3D')?.classList.add('active');
        buildSceneGraph();
        renderQuestionPopover();
      });
    });
    return;
  }

  if (node.type === 'step') {
    const st = node.raw;
    tag.className = 'node-type-badge badge-step';
    tag.textContent = `BƯỚC SUY LUẬN #${st.stepIndex}`;
    body.innerHTML = `
      <h3 class="insp-title">${escapeHTML(st.title)}</h3>
      <div class="insp-card insp-core">
        <div>${escapeHTML(st.description)}</div>
      </div>
    `;
    return;
  }

  if (node.type === 'problem') {
    const pr = node.raw;
    tag.className = 'node-type-badge badge-problem';
    tag.textContent = '⬢ VẤN ĐỀ CHUNG';
    body.innerHTML = `
      <h3 class="insp-title">${escapeHTML(pr.title)}</h3>
      <p class="insp-meta">${escapeHTML(pr.description)}</p>
    `;
  }
}

export function renderSidebarLineages(switchViewFn) {
  const state = getState();
  const list = $('#sidebarLineageList');
  const hudSelect = $('#hudLineageSelect');
  if (!list) return;

  const { selectedLineageId, isolatedFocusNodeId } = sceneState;

  const allBtnHtml = `
    <button class="lineage-item ${selectedLineageId === 'all' && !isolatedFocusNodeId ? 'active' : ''}" data-lin-id="all">
      <span class="lineage-dot-swatch" style="background:linear-gradient(135deg,#6366f1,#ec4899)"></span>
      <span style="flex:1">🌌 Toàn bộ các Phả hệ</span>
      <span class="tab-pill">${state.sources.length}</span>
    </button>
  `;

  const itemsHtml = state.ecosystems
    .map((eco) => {
      const count = state.sources.filter((s) => s.ecosystemId === eco.id).length;
      const active = selectedLineageId === eco.id && !isolatedFocusNodeId;
      return `
        <button class="lineage-item ${active ? 'active' : ''}" data-lin-id="${escapeHTML(eco.id)}">
          <span class="lineage-dot-swatch" style="background:${eco.color}"></span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(
            eco.title.replace(/^Phả hệ \d+:\s*/, '')
          )}</span>
          <span class="tab-pill">${count}</span>
        </button>`;
    })
    .join('');

  list.innerHTML = allBtnHtml + itemsHtml;

  $$('[data-lin-id]', list).forEach((btn) =>
    btn.addEventListener('click', () => {
      sceneState.selectedLineageId = btn.dataset.linId;
      sceneState.isolatedFocusNodeId = null;
      if (hudSelect) hudSelect.value = sceneState.selectedLineageId;
      if (sceneState.currentView !== 'explore' && typeof switchViewFn === 'function') {
        switchViewFn('explore');
      }
      buildSceneGraph();
      const firstPaper = state.sources.find(
        (s) => sceneState.selectedLineageId === 'all' || s.ecosystemId === sceneState.selectedLineageId
      );
      if (firstPaper) sceneState.activeNodeId = firstPaper.id;
      fitCameraToVisibleScene();
      renderSidebarLineages(switchViewFn);
      renderFloatingInspector();
    })
  );

  if (hudSelect) {
    hudSelect.innerHTML =
      `<option value="all">🌌 Toàn bộ các Phả hệ (${state.sources.length} bài)</option>` +
      state.ecosystems
        .map((e) => `<option value="${escapeHTML(e.id)}">🎯 ${escapeHTML(e.title)}</option>`)
        .join('');
    hudSelect.value = sceneState.selectedLineageId;
  }
}

export function renderQuestionPopover() {
  const state = getState();
  const activeQs = state.questions.filter((q) => q.status !== 'retired');
  const sel = $('#popoverQuestionSelect');
  const hyp = $('#popoverQuestionHyp');
  const stepsBox = $('#popoverStepsList');
  if (!sel) return;

  if (!activeQs.length) {
    sel.innerHTML = `<option value="">-- Đã xóa hết câu hỏi sai (Chỉ giữ Phả hệ) --</option>`;
    hyp.textContent =
      'Toàn bộ Phả hệ bài báo vẫn giữ nguyên 100%. Hãy bấm vào Nút Khe Hở (◇) trên 3D để tạo câu hỏi mới.';
    stepsBox.innerHTML = '';
    return;
  }

  if (!state.activeQuestionId || !activeQs.some((q) => q.id === state.activeQuestionId)) {
    state.activeQuestionId = activeQs[0].id;
  }
  const currentQ = activeQs.find((q) => q.id === state.activeQuestionId);

  sel.innerHTML = activeQs
    .map(
      (q) =>
        `<option value="${escapeHTML(q.id)}" ${q.id === currentQ.id ? 'selected' : ''}>${escapeHTML(q.title)}</option>`
    )
    .join('');

  hyp.textContent = currentQ.hypothesis || '';
  stepsBox.innerHTML = (currentQ.reasoningChain || [])
    .map(
      (st, idx) => `
      <div class="popover-step-item" data-pop-step="${escapeHTML(st.id)}">
        <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;color:#93c5fd">
          <span>Bước ${idx + 1}: ${escapeHTML(st.title)}</span>
          <span>${(st.linkedPaperIds || []).length} bài báo</span>
        </div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:2px">${escapeHTML(st.description)}</div>
      </div>`
    )
    .join('');

  $$('[data-pop-step]', stepsBox).forEach((el) =>
    el.addEventListener('click', () => {
      sceneState.showReasoning3D = true;
      $('#btnToggleReasoning3D')?.classList.add('active');
      buildSceneGraph();
      sceneState.activeNodeId = el.dataset.popStep;
      renderFloatingInspector();
    })
  );
}

export function initInspectorAndHudEvents(switchViewFn) {
  $('#hudLineageSelect')?.addEventListener('change', (e) => {
    sceneState.selectedLineageId = e.target.value;
    sceneState.isolatedFocusNodeId = null;
    buildSceneGraph();
    fitCameraToVisibleScene();
    renderSidebarLineages(switchViewFn);
    renderFloatingInspector();
  });

  $('#btnIsolateSelectedNode')?.addEventListener('click', () => {
    const state = getState();
    const currentPaper = state.sources.find((s) => s.id === sceneState.activeNodeId);
    if (!currentPaper) {
      notify('Hãy click chọn một Bài báo trên 3D trước để cô lập phả hệ của bài đó.');
      return;
    }
    if (sceneState.isolatedFocusNodeId === currentPaper.id) {
      sceneState.isolatedFocusNodeId = null;
      notify('Đã hiển thị lại toàn bộ phả hệ.');
    } else {
      sceneState.isolatedFocusNodeId = currentPaper.id;
      notify(`🎯 Đang chỉ hiển thị "${shortAuthor(currentPaper)}" cùng các bài con kế thừa & các bài tấn công nó!`);
    }
    buildSceneGraph();
    fitCameraToVisibleScene();
    renderSidebarLineages(switchViewFn);
    renderFloatingInspector();
  });

  $('#btnShowAllLineages')?.addEventListener('click', () => {
    sceneState.selectedLineageId = 'all';
    sceneState.isolatedFocusNodeId = null;
    buildSceneGraph();
    fitCameraToVisibleScene();
    renderSidebarLineages(switchViewFn);
    renderFloatingInspector();
  });

  $('#btnToggleReasoning3D')?.addEventListener('click', (e) => {
    sceneState.showReasoning3D = !sceneState.showReasoning3D;
    e.currentTarget.classList.toggle('active', sceneState.showReasoning3D);
    buildSceneGraph();
    fitCameraToVisibleScene();
  });

  $('#btnOpenQuestionPopover')?.addEventListener('click', () => {
    const pop = $('#questionPopover');
    pop.hidden = !pop.hidden;
    if (!pop.hidden) renderQuestionPopover();
  });
  $('#btnCloseQuestionPopover')?.addEventListener('click', () => ($('#questionPopover').hidden = true));

  $('#popoverQuestionSelect')?.addEventListener('change', (e) => {
    const state = getState();
    state.activeQuestionId = e.target.value;
    saveState();
    renderQuestionPopover();
    buildSceneGraph();
  });

  $('#btnAddStepQuick')?.addEventListener('click', () => {
    const state = getState();
    const q = state.questions.find((item) => item.id === state.activeQuestionId);
    if (!q) return;
    const t = prompt('Nhập tên bước suy luận mới:');
    if (!t?.trim()) return;
    q.reasoningChain.push({
      id: `st-${crypto.randomUUID().slice(0, 5)}`,
      stepOrder: q.reasoningChain.length + 1,
      title: t.trim(),
      description: 'Bước suy luận bổ sung',
      status: 'conditional',
      linkedPaperIds: sceneState.activeNodeId ? [sceneState.activeNodeId] : [],
    });
    sceneState.showReasoning3D = true;
    $('#btnToggleReasoning3D')?.classList.add('active');
    saveState();
    renderQuestionPopover();
    buildSceneGraph();
  });

  $('#btnNewQuestionQuick')?.addEventListener('click', () => {
    const state = getState();
    const t = prompt('Nhập câu hỏi nghiên cứu mới:');
    if (!t?.trim()) return;
    const newQ = {
      id: `q-${crypto.randomUUID().slice(0, 6)}`,
      title: t.trim(),
      hypothesis: 'Giả thuyết đang kiểm chứng trên đồ thị 3D',
      status: 'active',
      ecosystemId:
        sceneState.selectedLineageId === 'all' ? state.ecosystems[0]?.id : sceneState.selectedLineageId,
      createdAt: Date.now(),
      reasoningChain: [
        {
          id: `st-${crypto.randomUUID().slice(0, 5)}`,
          stepOrder: 1,
          title: 'Bước 1: Khởi tạo vấn đề',
          description: t.trim(),
          status: 'solid',
          linkedPaperIds: sceneState.activeNodeId ? [sceneState.activeNodeId] : [],
        },
      ],
    };
    state.questions.unshift(newQ);
    state.activeQuestionId = newQ.id;
    sceneState.showReasoning3D = true;
    $('#btnToggleReasoning3D')?.classList.add('active');
    saveState();
    renderQuestionPopover();
    buildSceneGraph();
  });

  $('#btnDeleteWrongQuestion3D')?.addEventListener('click', () => {
    const state = getState();
    const q = state.questions.find((item) => item.id === state.activeQuestionId);
    if (!q) return;
    if (
      !confirm(
        `Xóa câu hỏi sai "${q.title}"?\nToàn bộ Phả hệ bài báo và các Nút Khe Hở (◇) vẫn được giữ nguyên 100%.`
      )
    )
      return;
    q.status = 'retired';
    state.activeQuestionId = null;
    sceneState.showReasoning3D = false;
    $('#btnToggleReasoning3D')?.classList.remove('active');
    sceneState.showGaps3D = true;
    $('#btnToggleGaps3D')?.classList.add('active');
    saveState();
    renderQuestionPopover();
    buildSceneGraph();
    notify('Đã xóa câu hỏi sai! Phả hệ bài báo được giữ nguyên và các Nút Khe Hở (◇) đã hiển thị.');
  });

  $('#btnToggleProblems3D')?.addEventListener('click', (e) => {
    sceneState.showProblems3D = !sceneState.showProblems3D;
    e.currentTarget.classList.toggle('active', sceneState.showProblems3D);
    buildSceneGraph();
    fitCameraToVisibleScene();
  });

  $('#btnToggleGaps3D')?.addEventListener('click', (e) => {
    sceneState.showGaps3D = !sceneState.showGaps3D;
    e.currentTarget.classList.toggle('active', sceneState.showGaps3D);
    buildSceneGraph();
  });

  $('#btnToggleMicro3D')?.addEventListener('click', (e) => {
    sceneState.showMicro3D = !sceneState.showMicro3D;
    e.currentTarget.classList.toggle('active', sceneState.showMicro3D);
    buildSceneGraph();
  });

  $('#btnCloseInspector')?.addEventListener('click', () => {
    $('#floatingInspector')?.classList.add('minimized');
  });
}
