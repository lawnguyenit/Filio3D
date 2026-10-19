/**
 * @file src/main.js
 * @description Điểm khởi chạy trung tâm (Entrypoint) của ứng dụng Filio3D:
 * 1. Bắt buộc xác thực qua Cổng Khóa Truy Cập (`enforceAccessGate`) trước khi mở giao diện chính.
 * 2. Tải dữ liệu không gian 3D cô lập riêng cho `userId` vừa đăng nhập (`initWorkspaceForUser`).
 * 3. Kết nối điều hướng giữa 4 Tab chính và khởi tạo toàn bộ các Module chức năng.
 */

import { enforceAccessGate } from './auth/accessGate.js';
import {
  initWorkspaceForUser,
  getState,
  setState,
  saveState,
  resetToDefaultWorkspace,
  exportWorkspaceJson,
} from './store/workspaceStore.js';
import {
  sceneState,
  initSpatial3DEngine,
  buildSceneGraph,
  fitCameraToVisibleScene,
  resizeCanvas,
} from './engine/spatial3DEngine.js';
import {
  renderFloatingInspector,
  renderSidebarLineages,
  initInspectorAndHudEvents,
} from './views/inspectorView.js';
import { renderEditorTab, setEditingPaperId, initEditorEvents } from './views/editorView.js';
import { renderAiHubTab, initAiHubEvents } from './views/aiHubView.js';
import { renderMatrixTab } from './views/matrixView.js';
import { $, $$, notify } from './utils/dom.js';

export function switchView(nextView) {
  const state = getState();
  sceneState.currentView = nextView;
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === nextView));

  $('#viewExplore').hidden = nextView !== 'explore';
  $('#viewEditor').hidden = nextView !== 'editor';
  $('#viewAiHub').hidden = nextView !== 'ai-hub';
  $('#viewMatrix').hidden = nextView !== 'matrix';

  if (nextView === 'explore') {
    resizeCanvas();
    buildSceneGraph();
    renderFloatingInspector();
  } else if (nextView === 'editor') {
    const targetId =
      sceneState.activeNodeId && state.sources.some((s) => s.id === sceneState.activeNodeId)
        ? sceneState.activeNodeId
        : state.sources[0]?.id;
    setEditingPaperId(targetId);
    renderEditorTab();
  } else if (nextView === 'ai-hub') {
    renderAiHubTab();
  } else if (nextView === 'matrix') {
    renderMatrixTab(switchView);
  }
}

function bindGlobalSidebarEvents() {
  $$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  $('#btnJumpEditTab')?.addEventListener('click', () => {
    const state = getState();
    if (sceneState.activeNodeId && state.sources.some((s) => s.id === sceneState.activeNodeId)) {
      setEditingPaperId(sceneState.activeNodeId);
    }
    switchView('editor');
  });

  $('#btnAddEcosystem')?.addEventListener('click', () => {
    const state = getState();
    const title = prompt('Nhập tên Phả hệ nghiên cứu mới (VD: Phả hệ 4: Contrastive Learning):');
    if (!title?.trim()) return;
    const palette = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b'];
    const newEco = {
      id: `eco-${crypto.randomUUID().slice(0, 6)}`,
      title: title.trim(),
      description: 'Nhánh phả hệ nghiên cứu mới',
      color: palette[state.ecosystems.length % palette.length],
    };
    state.ecosystems.push(newEco);
    sceneState.selectedLineageId = newEco.id;
    sceneState.isolatedFocusNodeId = null;
    saveState();
    renderSidebarLineages(switchView);
    buildSceneGraph();
    notify('Đã tạo nhánh Phả hệ mới trong không gian của bạn!');
  });

  $('#btnResetDemo')?.addEventListener('click', () => {
    if (!confirm('Khôi phục bộ dữ liệu mẫu cho không gian riêng của bạn?')) return;
    resetToDefaultWorkspace();
    sceneState.selectedLineageId = 'eco-weak-label';
    sceneState.isolatedFocusNodeId = null;
    sceneState.activeNodeId = 'wl-1';
    switchView('explore');
    renderSidebarLineages(switchView);
    buildSceneGraph();
    fitCameraToVisibleScene();
    renderFloatingInspector();
    notify('Đã khôi phục dữ liệu mẫu cho không gian của bạn!');
  });

  $('#btnExportQuick')?.addEventListener('click', () => exportWorkspaceJson());

  $('#btnImportQuick')?.addEventListener('click', () => $('#fileImportQuick')?.click());
  $('#fileImportQuick')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.sources)) throw new Error('File không hợp lệ.');
        setState(parsed);
        renderSidebarLineages(switchView);
        buildSceneGraph();
        fitCameraToVisibleScene();
        renderFloatingInspector();
        notify('Đã nhập dữ liệu Phả hệ 3D vào không gian riêng của bạn!');
      } catch (err) {
        notify('Lỗi nhập JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  $('#toggleSidebar')?.addEventListener('click', () => {
    $('#sidebar')?.classList.toggle('collapsed');
    setTimeout(() => {
      resizeCanvas();
      fitCameraToVisibleScene();
    }, 200);
  });
}

// Khởi chạy ứng dụng sau khi vượt qua Cổng Khóa Truy Cập (Access Gate)
enforceAccessGate(async (session) => {
  await initWorkspaceForUser(session);

  initSpatial3DEngine({
    onNodeSelected: () => renderFloatingInspector(),
  });

  initInspectorAndHudEvents(switchView);
  initEditorEvents(switchView);
  initAiHubEvents(switchView);
  bindGlobalSidebarEvents();

  renderSidebarLineages(switchView);
  buildSceneGraph();
  fitCameraToVisibleScene();
  renderFloatingInspector();
});
