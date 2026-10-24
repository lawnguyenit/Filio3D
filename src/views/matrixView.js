/**
 * @file src/views/matrixView.js
 * @description Quản lý Tab 4 ("Ma trận & Khe hở"):
 * - Phân loại theo danh mục: Tất cả, Đòn Tấn công / Bác bỏ, Bài Nền tảng / Kế thừa, Khe hở nghiên cứu (◇).
 * - Tích hợp Tìm kiếm từ khóa theo thời gian thực (Tiêu đề, Tác giả, Điều kiện, Khe hở).
 * - Bộ lọc theo Phả hệ nghiên cứu.
 * - Cơ chế Phân trang mượt mà (Pagination) để không bị ngợp thông tin khi số lượng bài báo tăng cao.
 */

import { getState } from '../store/workspaceStore.js';
import { computeEcosystemGaps, promoteGapToQuestion } from '../engine/gapEngine.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { renderFloatingInspector, renderQuestionPopover } from './inspectorView.js';
import { setEditingPaperId, populatePaperEditorForm } from './editorView.js';
import { $, $$, escapeHTML, shortAuthor } from '../utils/dom.js';

let matrixFilterState = {
  category: 'all', // 'all' | 'attacker' | 'foundation' | 'gap'
  searchQuery: '',
  ecoId: 'all',
  page: 1,
  pageSize: 6,
};

export function renderMatrixTab(switchViewFn) {
  const state = getState();
  const container = $('#matrixContainer');
  if (!container) return;

  const allGaps = computeEcosystemGaps('all', null);

  // Thống kê số lượng theo danh mục
  const attackerSources = state.sources.filter((s) =>
    state.relations.some((r) => r.from === s.id && (r.type === 'refute' || r.type === 'conflict'))
  );
  const foundationSources = state.sources.filter(
    (s) => !state.relations.some((r) => r.from === s.id && (r.type === 'refute' || r.type === 'conflict'))
  );

  const query = matrixFilterState.searchQuery.toLowerCase();
  const chosenEco = matrixFilterState.ecoId;

  // Lọc danh sách hiển thị
  let displayItems = [];

  if (matrixFilterState.category === 'gap') {
    // Chỉ hiển thị Khe hở nghiên cứu
    displayItems = allGaps
      .filter((g) => {
        if (chosenEco !== 'all' && g.ecosystemId && g.ecosystemId !== chosenEco) return false;
        const text = `${g.title} ${g.kind} ${g.summary} ${g.missingCondition}`.toLowerCase();
        return text.includes(query);
      })
      .map((g) => ({ type: 'gap', data: g }));
  } else {
    // Lọc bài báo
    let sourcesToFilter = state.sources;
    if (matrixFilterState.category === 'attacker') {
      sourcesToFilter = attackerSources;
    } else if (matrixFilterState.category === 'foundation') {
      sourcesToFilter = foundationSources;
    }

    const filteredSources = sourcesToFilter.filter((p) => {
      if (chosenEco !== 'all' && p.ecosystemId !== chosenEco) return false;
      const condText = (p.conditions || []).map((c) => `${c.factor} ${c.value}`).join(' ');
      const text = `${p.title} ${p.authors} ${p.venue} ${p.coreKnowledge} ${p.limitations} ${condText}`.toLowerCase();
      return text.includes(query);
    });

    displayItems = filteredSources.map((p) => ({ type: 'paper', data: p }));

    // Nếu chọn 'all' và có tìm kiếm khe hở hoặc người dùng xem trang đầu
    if (matrixFilterState.category === 'all' && query) {
      const matchedGaps = allGaps
        .filter((g) => {
          if (chosenEco !== 'all' && g.ecosystemId && g.ecosystemId !== chosenEco) return false;
          const text = `${g.title} ${g.kind} ${g.summary} ${g.missingCondition}`.toLowerCase();
          return text.includes(query);
        })
        .map((g) => ({ type: 'gap', data: g }));
      displayItems = [...matchedGaps, ...displayItems];
    }
  }

  // Tính toán phân trang
  const totalItems = displayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / matrixFilterState.pageSize));
  if (matrixFilterState.page > totalPages) matrixFilterState.page = totalPages;
  if (matrixFilterState.page < 1) matrixFilterState.page = 1;

  const startIndex = (matrixFilterState.page - 1) * matrixFilterState.pageSize;
  const endIndex = Math.min(startIndex + matrixFilterState.pageSize, totalItems);
  const pagedItems = displayItems.slice(startIndex, endIndex);

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">
      <div>
        <span class="eyebrow">ĐỐI CHIẾU TRI THỨC · ĐIỀU KIỆN BIÊN · KHE HỞ NGHIÊN CỨU</span>
        <h1 style="margin:4px 0;font-size:20px">Ma Trận Đối Chiếu & Khe Hở Phả Hệ</h1>
      </div>
      <button class="primary-button" id="btnBackTo3DFromMatrix">◈ Trở về Không gian 3D</button>
    </div>

    <!-- FILTER & SEARCH TOOLBAR -->
    <div class="matrix-filter-card">
      <!-- CATEGORY PILLS -->
      <div class="matrix-category-tabs">
        <button type="button" class="matrix-cat-tab ${matrixFilterState.category === 'all' ? 'active' : ''}" data-cat="all">
          🌐 Tất cả (${state.sources.length} bài)
        </button>
        <button type="button" class="matrix-cat-tab ${matrixFilterState.category === 'attacker' ? 'active' : ''}" data-cat="attacker">
          🔴 Đòn Tấn công / Bác bỏ (${attackerSources.length})
        </button>
        <button type="button" class="matrix-cat-tab ${matrixFilterState.category === 'foundation' ? 'active' : ''}" data-cat="foundation">
          🟢 Nền tảng & Kế thừa (${foundationSources.length})
        </button>
        <button type="button" class="matrix-cat-tab ${matrixFilterState.category === 'gap' ? 'active' : ''}" data-cat="gap">
          🩷 Khe hở Nghiên cứu (${allGaps.length})
        </button>
      </div>

      <!-- SEARCH INPUT & LINEAGE DROPDOWN -->
      <div class="matrix-search-row">
        <div style="flex:1;position:relative">
          <input id="matrixSearchInput" class="text-field" placeholder="🔍 Tìm theo tên bài báo, tác giả, điều kiện biên, điểm gãy, khe hở..." value="${escapeHTML(matrixFilterState.searchQuery)}" />
        </div>
        <select id="matrixEcoSelect" class="text-field" style="max-width:210px">
          <option value="all">Tất cả Phả hệ</option>
          ${state.ecosystems
            .map(
              (e) =>
                `<option value="${escapeHTML(e.id)}" ${matrixFilterState.ecoId === e.id ? 'selected' : ''}>${escapeHTML(
                  e.title
                )}</option>`
            )
            .join('')}
        </select>
      </div>
    </div>

    <!-- PAGINATION INFO BAR -->
    <div class="matrix-count-row">
      <span style="font-size:12px;color:#64748b;font-weight:600">
        ${
          totalItems > 0
            ? `Hiển thị <b>${startIndex + 1} - ${endIndex}</b> trên tổng số <b>${totalItems}</b> mục`
            : `Không tìm thấy mục nào phù hợp.`
        }
      </span>
      ${
        totalPages > 1
          ? `<div class="matrix-pagination">
              <button type="button" class="page-nav-btn" id="btnPrevPage" ${matrixFilterState.page <= 1 ? 'disabled' : ''}>◀ Trước</button>
              <div class="page-pills">
                ${Array.from({ length: totalPages }, (_, i) => i + 1)
                  .map(
                    (pNum) =>
                      `<button type="button" class="page-pill ${pNum === matrixFilterState.page ? 'active' : ''}" data-page="${pNum}">${pNum}</button>`
                  )
                  .join('')}
              </div>
              <button type="button" class="page-nav-btn" id="btnNextPage" ${matrixFilterState.page >= totalPages ? 'disabled' : ''}>Sau ▶</button>
            </div>`
          : ''
      }
    </div>

    <!-- CARDS GRID -->
    <div class="matrix-cards-grid" style="margin-top:14px">
      ${
        pagedItems.length === 0
          ? `<div style="grid-column:1/-1;text-align:center;padding:48px 16px;background:#ffffff;border-radius:12px;border:1px dashed #cbd5e1;color:#64748b">
              Chưa có dữ liệu phù hợp với bộ lọc hiện tại. Thử đổi danh mục hoặc xóa từ khóa tìm kiếm.
            </div>`
          : pagedItems
              .map((item) => {
                if (item.type === 'gap') {
                  const g = item.data;
                  return `
                    <div class="visual-gap-card">
                      <div class="visual-gap-head">
                        <span class="gap-Axis-pill">◇ ${escapeHTML(g.kind)}</span>
                        <button class="primary-button tiny-btn" data-gap-promote-title="${escapeHTML(g.title)}">✦ Tạo Câu hỏi mới</button>
                      </div>
                      <h3 class="visual-gap-title">${escapeHTML(g.title)}</h3>
                      <p class="visual-gap-desc">${escapeHTML(g.summary)}</p>
                      <div class="matrix-section-block block-conditions">
                        <span class="block-label">⚖️ MIỀN ĐIỀU KIỆN CẦN KIỂM TRA</span>
                        <div>${escapeHTML(g.missingCondition)}</div>
                      </div>
                    </div>`;
                }

                const p = item.data;
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
              .join('')
      }
    </div>

    <!-- BOTTOM PAGINATION CONTROLS (IF MANY ITEMS) -->
    ${
      totalPages > 1
        ? `<div class="matrix-count-row" style="margin-top:20px;justify-content:center">
            <div class="matrix-pagination">
              <button type="button" class="page-nav-btn" id="btnPrevPageBottom" ${matrixFilterState.page <= 1 ? 'disabled' : ''}>◀ Trước</button>
              <span style="font-size:12px;font-weight:700;color:#334155;padding:0 8px">Trang ${matrixFilterState.page} / ${totalPages}</span>
              <button type="button" class="page-nav-btn" id="btnNextPageBottom" ${matrixFilterState.page >= totalPages ? 'disabled' : ''}>Sau ▶</button>
            </div>
          </div>`
        : ''
    }
  `;

  // EVENT LISTENERS
  $('#btnBackTo3DFromMatrix', container)?.addEventListener('click', () => {
    if (typeof switchViewFn === 'function') switchViewFn('explore');
  });

  // Switch category tabs
  $$('.matrix-cat-tab', container).forEach((tab) =>
    tab.addEventListener('click', () => {
      matrixFilterState.category = tab.dataset.cat;
      matrixFilterState.page = 1;
      renderMatrixTab(switchViewFn);
    })
  );

  // Search input
  const searchInput = $('#matrixSearchInput', container);
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      matrixFilterState.searchQuery = e.target.value;
      matrixFilterState.page = 1;
      renderMatrixTab(switchViewFn);
      // Re-focus search input and maintain cursor
      const nextInput = $('#matrixSearchInput', container);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  }

  // Lineage select
  $('#matrixEcoSelect', container)?.addEventListener('change', (e) => {
    matrixFilterState.ecoId = e.target.value;
    matrixFilterState.page = 1;
    renderMatrixTab(switchViewFn);
  });

  // Page buttons
  $$('.page-pill', container).forEach((pill) =>
    pill.addEventListener('click', () => {
      matrixFilterState.page = parseInt(pill.dataset.page, 10);
      renderMatrixTab(switchViewFn);
    })
  );

  const prevHandler = () => {
    if (matrixFilterState.page > 1) {
      matrixFilterState.page--;
      renderMatrixTab(switchViewFn);
    }
  };
  const nextHandler = () => {
    if (matrixFilterState.page < totalPages) {
      matrixFilterState.page++;
      renderMatrixTab(switchViewFn);
    }
  };

  $('#btnPrevPage', container)?.addEventListener('click', prevHandler);
  $('#btnPrevPageBottom', container)?.addEventListener('click', prevHandler);
  $('#btnNextPage', container)?.addEventListener('click', nextHandler);
  $('#btnNextPageBottom', container)?.addEventListener('click', nextHandler);

  // Gap promote
  $$('[data-gap-promote-title]', container).forEach((btn) =>
    btn.addEventListener('click', () => {
      const g = allGaps.find((gap) => gap.title === btn.dataset.gapPromoteTitle);
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

  // Isolate paper on 3D
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

  // Edit paper
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
