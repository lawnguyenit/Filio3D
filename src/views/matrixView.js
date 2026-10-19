/**
 * @file src/views/matrixView.js
 * @description Quản lý Tab 4 ("Ma trận & Khe hở"):
 * - Trình bày trực quan theo hệ thống Thẻ Phân Tầng Màu Sắc (Stratified Visual Cards).
 * - Phân biệt rõ ràng Tầng Khe hở nghiên cứu (Hồng/Tím), Bài Nền tảng/Kế thừa (Xanh), Bài Tấn công/Bác bỏ (Đỏ), và các Nhãn Điều Kiện (Pills màu Vàng).
 */

import { getState } from '../store/workspaceStore.js';
import { computeEcosystemGaps, promoteGapToQuestion } from '../engine/gapEngine.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { renderFloatingInspector, renderQuestionPopover } from './inspectorView.js';
import { setEditingPaperId, populatePaperEditorForm } from './editorView.js';
import { $, $$, escapeHTML, shortAuthor } from '../utils/dom.js';

export function renderMatrixTab(switchViewFn) {
  const state = getState();
  const container = $('#matrixContainer');
  if (!container) return;
  const gaps = computeEcosystemGaps('all', null);

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">
      <div>
        <span class="eyebrow">PHÂN TẦNG TRỰC QUAN ĐIỀU KIỆN BÀI BÁO & KHE HỞ NGHIÊN CỨU</span>
        <h1 style="margin:4px 0;font-size:20px">Bản đồ Phân tầng Điều kiện & ${gaps.length} Khe hở Phả hệ</h1>
      </div>
      <button class="primary-button" id="btnBackTo3DFromMatrix">◈ Quay lại Không gian 3D</button>
    </div>

    <div class="matrix-legend-bar">
      <span style="font-size:11px;font-weight:800;color:#475569">CHÚ GIẢI PHÂN TẦNG MÀU SẮC:</span>
      <span class="legend-pill legend-foundation">🟢 Tầng Nền tảng / Kế thừa</span>
      <span class="legend-pill legend-attacker">🔴 Tầng Tấn công / Bác bỏ</span>
      <span class="legend-pill legend-condition">🟡 Nhãn Điều kiện để bài báo Đúng</span>
      <span class="legend-pill legend-gap">🩷 Khe hở Nghiên cứu (◇)</span>
    </div>

    <div style="margin-top:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="step-badge badge-red" style="background:#fce7f3;color:#9d174d">TẦNG KHE HỞ NGHIÊN CỨU (${gaps.length})</span>
        <b style="font-size:14px;color:#0f172a">Các Lỗ hổng xuất hiện giữa Bài Gốc và Bài Tấn Công</b>
      </div>
      <div class="gap-cards-grid">
        ${gaps
          .map(
            (g, idx) => `
            <div class="visual-gap-card">
              <div class="visual-gap-head">
                <span class="gap-Axis-pill">◇ ${escapeHTML(g.kind)}</span>
                <button class="primary-button tiny-btn" data-gap-promote-idx="${idx}">✦ Tạo Câu hỏi mới</button>
              </div>
              <h3 class="visual-gap-title">${escapeHTML(g.title)}</h3>
              <p class="visual-gap-desc">${escapeHTML(g.summary)}</p>
              <div class="matrix-section-block block-conditions">
                <span class="block-label">⚖️ MIỀN ĐIỀU KIỆN CHƯA AI GIẢI QUYẾT</span>
                <div>${escapeHTML(g.missingCondition)}</div>
              </div>
            </div>`
          )
          .join('')}
      </div>
    </div>

    <div style="margin-top:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="step-badge badge-green">TẦNG ĐỐI CHIẾU BÀI BÁO (${state.sources.length} BÀI)</span>
        <b style="font-size:14px;color:#0f172a">Phân biệt rõ Bài Nền tảng (Xanh) vs. Bài Tấn công (Đỏ) và các Nhãn Điều Kiện (Vàng)</b>
      </div>

      <div class="matrix-cards-grid">
        ${state.sources
          .map((p) => {
            const eco = state.ecosystems.find((e) => e.id === p.ecosystemId);
            const ecoColor = eco?.color || '#6366f1';
            const shortEco = (eco?.title || '').replace(/^Phả hệ \d+:\s*/, '');
            const attackRels = state.relations.filter(
              (r) => r.from === p.id && (r.type === 'refute' || r.type === 'conflict')
            );
            const isAttacker = attackRels.length > 0;

            return `
              <div class="matrix-paper-card ${isAttacker ? 'stratum-attacker' : 'stratum-foundation'}">
                <div class="matrix-card-top">
                  <span class="matrix-role-badge ${isAttacker ? 'role-attacker' : 'role-foundation'}">
                    ${isAttacker ? '🔴 ĐÒN TẤN CÔNG / BÁC BỎ' : '🟢 BÀI GỐC / KẾ THỪA'}
                  </span>
                  <div style="display:flex;gap:5px;align-items:center">
                    <span class="card-chip chip-lineage" style="background:${ecoColor}">${escapeHTML(shortEco)}</span>
                    <span class="card-chip chip-year">${p.year}</span>
                  </div>
                </div>

                <div>
                  <h3 class="matrix-card-title" data-matrix-isolate="${escapeHTML(p.id)}">${escapeHTML(p.title)}</h3>
                  <div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHTML(p.authors)} · ${escapeHTML(p.venue)}</div>
                </div>

                ${
                  attackRels.length
                    ? `<div>
                        ${attackRels
                          .map((ar) => {
                            const targetP = state.sources.find((s) => s.id === ar.to);
                            return `<span class="attack-target-pill">⚡ Tấn công trực tiếp: ${escapeHTML(
                              shortAuthor(targetP)
                            )} (${targetP?.year || ''})</span>`;
                          })
                          .join(' ')}
                      </div>`
                    : ''
                }

                <div class="matrix-section-block block-claim">
                  <span class="block-label">💡 ĐÓNG GÓP CỐT LÕI</span>
                  <div>${escapeHTML(p.coreKnowledge)}</div>
                </div>

                <div class="matrix-section-block block-conditions">
                  <span class="block-label">⚖️ ĐIỀU KIỆN BẮT BUỘC ĐỂ BÀI BÁO ĐÚNG</span>
                  <div class="cond-pill-list">
                    ${(p.conditions || [])
                      .map(
                        (c) =>
                          `<span class="cond-pill-tag"><b>${escapeHTML(c.factor)}:</b> ${escapeHTML(c.value)}</span>`
                      )
                      .join('')}
                  </div>
                </div>

                <div class="matrix-section-block block-breaks">
                  <span class="block-label">⚠️ ĐIỂM GÃY / KHI NÀO BÀI BÁO SỤP ĐỔ?</span>
                  <div>${escapeHTML(p.limitations || 'Chưa ghi điểm gãy.')}</div>
                </div>

                <div style="display:flex;gap:6px;margin-top:auto;padding-top:4px">
                  <button class="secondary-button tiny-btn" style="flex:1" data-matrix-isolate="${escapeHTML(p.id)}">
                    🎯 Cô lập nhánh trên 3D
                  </button>
                  <button class="outline-button tiny-btn" data-matrix-edit="${escapeHTML(p.id)}">
                    ✎ Sửa bài
                  </button>
                </div>
              </div>`;
          })
          .join('')}
      </div>
    </div>
  `;

  $('#btnBackTo3DFromMatrix', container)?.addEventListener('click', () => {
    if (typeof switchViewFn === 'function') switchViewFn('explore');
  });

  $$('[data-gap-promote-idx]', container).forEach((btn) =>
    btn.addEventListener('click', () => {
      const g = gaps[parseInt(btn.dataset.gapPromoteIdx, 10)];
      if (g) {
        promoteGapToQuestion(g, () => {
          sceneState.showReasoning3D = true;
          $('#btnToggleReasoning3D')?.classList.add('active');
          if (typeof switchViewFn === 'function') switchViewFn('explore');
          buildSceneGraph();
          renderQuestionPopover();
        });
      }
    })
  );

  $$('[data-matrix-isolate]', container).forEach((btn) =>
    btn.addEventListener('click', () => {
      sceneState.isolatedFocusNodeId = btn.dataset.matrixIsolate;
      sceneState.activeNodeId = sceneState.isolatedFocusNodeId;
      if (typeof switchViewFn === 'function') switchViewFn('explore');
      buildSceneGraph();
      fitCameraToVisibleScene();
      renderFloatingInspector();
    })
  );

  $$('[data-matrix-edit]', container).forEach((btn) =>
    btn.addEventListener('click', () => {
      const pid = btn.dataset.matrixEdit;
      setEditingPaperId(pid);
      sceneState.activeNodeId = pid;
      if (typeof switchViewFn === 'function') switchViewFn('editor');
      populatePaperEditorForm(state.sources.find((s) => s.id === pid));
    })
  );
}
