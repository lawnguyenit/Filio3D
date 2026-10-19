/**
 * @file src/views/editorView.js
 * @description Quản lý Tab 2 ("Thêm & Sửa Bài báo"):
 * - Cột trái: Hiển thị danh sách thẻ bài báo ngắn gọn, có viền màu theo Phả hệ và các nhãn màu trực quan (Năm, Tác giả, Phả hệ, Bài tấn công / Số ĐK).
 * - Cột phải: Chia thành 4 Sub-tabs có màu sắc riêng biệt (1. Thông tin & Đóng góp, 2. Điều kiện & Điểm gãy, 3. Mũi tên Phả hệ & Tấn công, 4. Chuỗi suy luận).
 */

import { ARROW_TYPES, CONDITION_CATEGORIES } from '../config/constants.js';
import { getState, saveState } from '../store/workspaceStore.js';
import { sceneState, buildSceneGraph, fitCameraToVisibleScene } from '../engine/spatial3DEngine.js';
import { renderSidebarLineages } from './inspectorView.js';
import { $, $$, escapeHTML, shortAuthor, notify } from '../utils/dom.js';

let currentEditingPaperId = 'wl-1';

export function setEditingPaperId(id) {
  currentEditingPaperId = id;
}

export function switchEditorSubtab(subtabId) {
  $$('.subtab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.subtab === subtabId));
  ['tab-core', 'tab-cond', 'tab-links', 'tab-chain'].forEach((id) => {
    const panel = $(`#subtab-${id}`);
    if (panel) panel.hidden = id !== subtabId;
  });
}

function updateSubtabCounts() {
  const state = getState();
  const condCount = $$('.condition-edit-row', $('#editPaperConditions')).length;
  const chainCount = $$('.chain-edit-row', $('#editPaperInternalChain')).length;
  const pid = $('#editPaperId')?.value;
  const relCount = pid ? state.relations.filter((r) => r.from === pid || r.to === pid).length : 0;

  if ($('#subtabCondCount')) $('#subtabCondCount').textContent = condCount;
  if ($('#subtabRelCount')) $('#subtabRelCount').textContent = relCount;
  if ($('#subtabChainCount')) $('#subtabChainCount').textContent = chainCount;
}

export function renderEditorTab() {
  const state = getState();
  const listEl = $('#editorPaperList');
  const ecoFilterEl = $('#editorEcoFilter');
  const searchVal = ($('#editorSearchInput')?.value || '').trim().toLowerCase();

  if (ecoFilterEl) {
    const prevVal = ecoFilterEl.value || 'all';
    ecoFilterEl.innerHTML =
      `<option value="all">Tất cả Phả hệ</option>` +
      state.ecosystems.map((e) => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>`).join('');
    if ([...ecoFilterEl.options].some((o) => o.value === prevVal)) {
      ecoFilterEl.value = prevVal;
    }
  }
  const chosenEco = ecoFilterEl?.value || 'all';

  const filtered = state.sources.filter((s) => {
    if (chosenEco !== 'all' && s.ecosystemId !== chosenEco) return false;
    const text = `${s.title} ${s.authors} ${s.coreKnowledge} ${s.limitations}`.toLowerCase();
    return text.includes(searchVal);
  });

  if ($('#editorPaperCount')) $('#editorPaperCount').textContent = filtered.length;

  listEl.innerHTML = filtered
    .map((p) => {
      const eco = state.ecosystems.find((e) => e.id === p.ecosystemId);
      const ecoColor = eco?.color || '#6366f1';
      const shortEcoName = (eco?.title || 'Phả hệ').replace(/^Phả hệ \d+:\s*/, '').slice(0, 18);
      const isAttacker = state.relations.some(
        (r) => r.from === p.id && (r.type === 'refute' || r.type === 'conflict')
      );
      const condCount = (p.conditions || []).length;

      return `
      <div class="paper-list-card ${p.id === currentEditingPaperId ? 'selected' : ''}"
           style="border-left-color: ${isAttacker ? '#ef4444' : ecoColor}"
           data-edit-select="${escapeHTML(p.id)}">
        <h4 class="paper-card-title">${escapeHTML(p.title)}</h4>
        <div class="paper-card-chips">
          <span class="card-chip chip-year">${p.year}</span>
          <span class="card-chip chip-author">${escapeHTML(shortAuthor(p))}</span>
          <span class="card-chip chip-lineage" style="background:${ecoColor}">${escapeHTML(shortEcoName)}</span>
          ${
            isAttacker
              ? `<span class="card-chip chip-attack">⚡ Bài Tấn công</span>`
              : `<span class="card-chip chip-cond-count">⚖ ${condCount} ĐK</span>`
          }
        </div>
      </div>`;
    })
    .join('');

  $$('[data-edit-select]', listEl).forEach((card) =>
    card.addEventListener('click', () => {
      currentEditingPaperId = card.dataset.editSelect;
      renderEditorTab();
      populatePaperEditorForm(state.sources.find((s) => s.id === currentEditingPaperId));
    })
  );

  const activePaper = state.sources.find((s) => s.id === currentEditingPaperId) || state.sources[0];
  if (activePaper && $('#editPaperId').value !== activePaper.id) {
    populatePaperEditorForm(activePaper);
  }
}

function addEditorConditionRow(cond = { category: 'data', factor: '', value: '' }) {
  const box = $('#editPaperConditions');
  const row = document.createElement('div');
  row.className = 'condition-edit-row';
  row.innerHTML = `
    <select class="text-field cond-cat">
      ${Object.entries(CONDITION_CATEGORIES)
        .map(([k, v]) => `<option value="${k}" ${cond.category === k ? 'selected' : ''}>${escapeHTML(v)}</option>`)
        .join('')}
    </select>
    <input class="text-field cond-factor" placeholder="Yếu tố (VD: Giả định nhiễu)" value="${escapeHTML(
      cond.factor
    )}" />
    <input class="text-field cond-val" placeholder="Điều kiện cụ thể để bài báo đúng..." value="${escapeHTML(
      cond.value
    )}" />
    <button type="button" class="icon-button remove-row" style="color:#ef4444">×</button>
  `;
  $('.remove-row', row).addEventListener('click', () => {
    row.remove();
    updateSubtabCounts();
  });
  box.appendChild(row);
  updateSubtabCounts();
}

function addEditorChainRow(step = { stage: 'Vấn đề', text: '' }) {
  const box = $('#editPaperInternalChain');
  const row = document.createElement('div');
  row.className = 'chain-edit-row';
  row.innerHTML = `
    <input class="text-field chain-stage" placeholder="Bước (VD: Điều kiện)" value="${escapeHTML(step.stage)}" />
    <input class="text-field chain-text" placeholder="Nội dung bước suy luận trong bài báo..." value="${escapeHTML(
      step.text
    )}" />
    <button type="button" class="icon-button remove-row" style="color:#ef4444">×</button>
  `;
  $('.remove-row', row).addEventListener('click', () => {
    row.remove();
    updateSubtabCounts();
  });
  box.appendChild(row);
  updateSubtabCounts();
}

export function populatePaperEditorForm(paper) {
  const state = getState();
  $('#editorFormHeading').textContent = paper ? `Chỉnh sửa: ${paper.title.slice(0, 48)}…` : 'Thêm Bài báo Mới';
  $('#editPaperId').value = paper?.id || '';
  $('#editPaperTitle').value = paper?.title || '';
  $('#editPaperAuthors').value = paper?.authors || '';
  $('#editPaperYear').value = paper?.year || new Date().getFullYear();
  $('#editPaperVenue').value = paper?.venue || '';
  $('#editPaperCore').value = paper?.coreKnowledge || '';
  $('#editPaperLimits').value = paper?.limitations || '';

  $('#editPaperEcosystem').innerHTML = state.ecosystems
    .map(
      (e) =>
        `<option value="${escapeHTML(e.id)}" ${paper?.ecosystemId === e.id ? 'selected' : ''}>${escapeHTML(
          e.title
        )}</option>`
    )
    .join('');

  $('#editPaperProblem').innerHTML =
    `<option value="">-- Không gắn --</option>` +
    state.problems
      .map(
        (pr) =>
          `<option value="${escapeHTML(pr.id)}" ${paper?.problemId === pr.id ? 'selected' : ''}>${escapeHTML(
            pr.title
          )}</option>`
      )
      .join('');

  $('#editPaperConditions').innerHTML = '';
  (paper?.conditions?.length
    ? paper.conditions
    : [{ category: 'method', factor: 'Giả định cốt lõi', value: '' }]
  ).forEach((c) => addEditorConditionRow(c));

  $('#editPaperInternalChain').innerHTML = '';
  (paper?.internalChain?.length
    ? paper.internalChain
    : [
        { stage: 'Vấn đề', text: '' },
        { stage: 'Điều kiện', text: '' },
        { stage: 'Phương pháp', text: '' },
        { stage: 'Kết luận', text: '' },
      ]
  ).forEach((st) => addEditorChainRow(st));

  renderInlinePaperRelations(paper?.id);
  updateSubtabCounts();
}

function renderInlinePaperRelations(paperId) {
  const state = getState();
  const targetSelect = $('#inlineRelTarget');
  const relList = $('#editPaperRelationsList');
  if (!targetSelect || !relList) return;

  targetSelect.innerHTML = state.sources
    .filter((s) => s.id !== paperId)
    .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.title)} (${s.year})</option>`)
    .join('');

  if (!paperId) {
    relList.innerHTML = `<div style="font-size:11px;color:#64748b">Lưu bài báo trước khi nối mũi tên phả hệ.</div>`;
    updateSubtabCounts();
    return;
  }

  const rels = state.relations.filter((r) => r.from === paperId || r.to === paperId);
  relList.innerHTML = rels.length
    ? rels
        .map((r) => {
          const isOut = r.from === paperId;
          const other = state.sources.find((s) => s.id === (isOut ? r.to : r.from));
          const st = ARROW_TYPES[r.type] || ARROW_TYPES.support;
          return `
            <div class="paper-list-card" style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:9px 12px;border-left-color:${st.color}">
              <span class="rel-badge rel-${r.type}">${st.short}</span>
              <div style="flex:1">
                <b>${isOut ? '➔ Tới:' : '⬅ Từ:'} ${escapeHTML(other?.title || '')}</b>
                <div style="font-size:11px;color:#64748b">${escapeHTML(r.label)}</div>
              </div>
              <button type="button" class="danger-outline-button tiny-btn" data-del-rel="${escapeHTML(r.id)}">Xóa cạnh</button>
            </div>`;
        })
        .join('')
    : `<div style="font-size:11px;color:#64748b">Chưa có mũi tên nào. Hãy chọn bài đích ở trên và bấm "＋ Thêm cạnh".</div>`;

  $$('[data-del-rel]', relList).forEach((btn) =>
    btn.addEventListener('click', () => {
      state.relations = state.relations.filter((r) => r.id !== btn.dataset.delRel);
      saveState();
      renderInlinePaperRelations(paperId);
      buildSceneGraph();
      notify('Đã xóa mũi tên liên kết.');
    })
  );
  updateSubtabCounts();
}

export function initEditorEvents(switchViewFn) {
  $$('.subtab-btn').forEach((btn) =>
    btn.addEventListener('click', () => switchEditorSubtab(btn.dataset.subtab))
  );

  $('#editorSearchInput')?.addEventListener('input', renderEditorTab);
  $('#editorEcoFilter')?.addEventListener('change', renderEditorTab);

  $('#btnCreateNewPaper')?.addEventListener('click', () => {
    currentEditingPaperId = '';
    populatePaperEditorForm(null);
    switchEditorSubtab('tab-core');
    $('#editPaperTitle')?.focus();
  });

  $('#btnAddCondRowEditor')?.addEventListener('click', () => addEditorConditionRow());
  $('#btnAddChainRowEditor')?.addEventListener('click', () => addEditorChainRow({ stage: 'Bước tiếp', text: '' }));

  $('#btnSavePaperEditor')?.addEventListener('click', () => {
    const state = getState();
    const title = $('#editPaperTitle').value.trim();
    const core = $('#editPaperCore').value.trim();
    if (!title || !core) {
      switchEditorSubtab('tab-core');
      notify('Vui lòng nhập Tiêu đề và Đóng góp/Tri thức cốt lõi của bài báo.');
      return;
    }
    const id = $('#editPaperId').value || `p-${crypto.randomUUID().slice(0, 6)}`;
    const conditions = $$('.condition-edit-row', $('#editPaperConditions'))
      .map((r) => ({
        category: $('.cond-cat', r).value,
        factor: $('.cond-factor', r).value.trim() || 'Điều kiện',
        value: $('.cond-val', r).value.trim(),
      }))
      .filter((c) => c.value);

    const internalChain = $$('.chain-edit-row', $('#editPaperInternalChain'))
      .map((r) => ({
        stage: $('.chain-stage', r).value.trim() || 'Bước',
        text: $('.chain-text', r).value.trim(),
      }))
      .filter((s) => s.text);

    const record = {
      id,
      title,
      authors: $('#editPaperAuthors').value.trim() || 'Chưa ghi tác giả',
      year: parseInt($('#editPaperYear').value, 10) || 2024,
      venue: $('#editPaperVenue').value.trim() || 'Nghiên cứu',
      ecosystemId: $('#editPaperEcosystem').value || state.ecosystems[0]?.id,
      problemId: $('#editPaperProblem').value || '',
      coreKnowledge: core,
      conditions,
      limitations: $('#editPaperLimits').value.trim(),
      internalChain,
    };

    const existingIdx = state.sources.findIndex((s) => s.id === id);
    if (existingIdx !== -1) state.sources[existingIdx] = record;
    else state.sources.unshift(record);

    currentEditingPaperId = id;
    sceneState.activeNodeId = id;
    saveState();
    renderEditorTab();
    renderSidebarLineages(switchViewFn);
    notify('💾 Đã lưu bài báo và cập nhật vào Phả hệ 3D!');
  });

  $('#btnAddInlineRel')?.addEventListener('click', () => {
    const state = getState();
    const pid = $('#editPaperId').value;
    if (!pid) {
      notify('Hãy bấm "Lưu Bài Báo" trước khi thêm cạnh.');
      return;
    }
    const dir = $('#inlineRelDirection').value;
    const type = $('#inlineRelType').value;
    const targetId = $('#inlineRelTarget').value;
    const note = $('#inlineRelNote').value.trim() || ARROW_TYPES[type]?.label;
    if (!targetId) return;

    state.relations.push({
      id: `rel-${crypto.randomUUID().slice(0, 6)}`,
      from: dir === 'out' ? pid : targetId,
      to: dir === 'out' ? targetId : pid,
      type,
      label: note,
      conditionNote: note,
    });
    $('#inlineRelNote').value = '';
    saveState();
    renderInlinePaperRelations(pid);
    renderEditorTab();
    notify('Đã thêm mũi tên tương tác 3D!');
  });

  $('#btnViewCurrentIn3D')?.addEventListener('click', () => {
    const pid = $('#editPaperId').value;
    if (pid) {
      sceneState.activeNodeId = pid;
      sceneState.isolatedFocusNodeId = pid;
    }
    if (typeof switchViewFn === 'function') switchViewFn('explore');
    fitCameraToVisibleScene();
  });

  $('#btnDeleteCurrentPaper')?.addEventListener('click', () => {
    const state = getState();
    const pid = $('#editPaperId').value;
    if (!pid || !confirm('Xóa bài báo này khỏi hệ sinh thái?')) return;
    state.sources = state.sources.filter((s) => s.id !== pid);
    state.relations = state.relations.filter((r) => r.from !== pid && r.to !== pid);
    saveState();
    currentEditingPaperId = state.sources[0]?.id || '';
    renderEditorTab();
    notify('Đã xóa bài báo.');
  });
}
