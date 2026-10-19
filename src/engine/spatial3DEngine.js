/**
 * @file src/engine/spatial3DEngine.js
 * @description Bộ máy Không gian 3D Đa Tầng (True Volumetric 3D Engine):
 * - Phân bổ các nút nghiên cứu vào không gian 3 chiều thực thụ (X: Tiến trình thời gian, Y: Phân tầng Đỉnh/Giữa/Đáy, Z: Chiều sâu nhánh).
 * - Tích hợp thuật toán chống chồng chéo 3D (`relaxNodePositions3D`) đảm bảo các nút luôn thoáng ở mọi góc nhìn.
 * - Hỗ trợ cô lập Phả hệ (`selectedLineageId`) và cô lập Nhánh của 1 bài báo đơn lẻ (`isolatedFocusNodeId`).
 * - Hỗ trợ xoay 360° Turntable, 5 góc nhìn Camera nhanh (Góc 3D, Chính diện, Từ đỉnh, Cắt ngang, Tự xoay 360°) và la bàn trục X-Y-Z.
 */

import { ARROW_TYPES } from '../config/constants.js';
import { getState, saveState } from '../store/workspaceStore.js';
import { computeEcosystemGaps } from './gapEngine.js';
import { $, $$, shortAuthor, notify } from '../utils/dom.js';

export const sceneState = {
  currentView: 'explore',
  layoutMode: 'lineage', // 'lineage' | 'helix' | 'force'
  selectedLineageId: 'eco-weak-label',
  isolatedFocusNodeId: null,
  spreadFactor: 1.4,
  autoOrbit: false,
  showReasoning3D: false,
  showProblems3D: false,
  showGaps3D: true,
  showMicro3D: false,
  darkStage: true,
  activeArrowFilters: new Set(Object.keys(ARROW_TYPES)),
  activeNodeId: 'wl-1',
  hoveredNodeId: null,
  linkModeState: { active: false, fromNodeId: null },
  sceneNodes: [],
  sceneEdges: [],
};

const cam = {
  yaw: -0.52,
  pitch: 0.34,
  zoom: 0.98,
  panX: -95,
  panY: 0,
  targetYaw: -0.52,
  targetPitch: 0.34,
  targetZoom: 0.98,
  targetPanX: -95,
  targetPanY: 0,
};

let canvas = null;
let stage = null;
let ctx = null;
let animTick = 0;
let dragState = null;
const forcePositions = new Map();
let onSelectionChangeCallback = null;

export function getIsolatedNeighborhoodPaperIds(focalPaperId) {
  const state = getState();
  const allowed = new Set([focalPaperId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of state.relations) {
      if (r.type === 'lineage') {
        if (allowed.has(r.from) && !allowed.has(r.to)) {
          allowed.add(r.to);
          changed = true;
        }
        if (allowed.has(r.to) && !allowed.has(r.from)) {
          allowed.add(r.from);
          changed = true;
        }
      }
    }
  }
  for (const r of state.relations) {
    if (r.from === focalPaperId || r.to === focalPaperId || allowed.has(r.from) || allowed.has(r.to)) {
      allowed.add(r.from);
      allowed.add(r.to);
    }
  }
  return allowed;
}

function relaxNodePositions3D(nodes, minDistance = 2.5) {
  const movable = nodes.filter((n) => n.type !== 'micro');
  for (let iter = 0; iter < 38; iter++) {
    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const a = movable[i];
        const b = movable[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 0.01;
        if (dist < minDistance) {
          const push = ((minDistance - dist) / dist) * 0.42;
          if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) dx = 0.12 * (i % 2 ? 1 : -1);
          b.x += dx * push;
          b.y += dy * push * 0.65;
          b.z += dz * push * 0.85;
          a.x -= dx * push;
          a.y -= dy * push * 0.65;
          a.z -= dz * push * 0.85;
        }
      }
    }
  }
}

export function buildSceneGraph() {
  const state = getState();
  const nodes = [];
  const edges = [];
  const {
    isolatedFocusNodeId,
    selectedLineageId,
    layoutMode,
    spreadFactor,
    showProblems3D,
    showReasoning3D,
    showGaps3D,
    showMicro3D,
    activeNodeId,
    activeArrowFilters,
  } = sceneState;

  let visiblePapers = state.sources;
  let isolatedSet = null;

  if (isolatedFocusNodeId && state.sources.some((s) => s.id === isolatedFocusNodeId)) {
    isolatedSet = getIsolatedNeighborhoodPaperIds(isolatedFocusNodeId);
    visiblePapers = state.sources.filter((s) => isolatedSet.has(s.id));
  } else if (selectedLineageId !== 'all') {
    const baseIds = new Set(
      state.sources.filter((s) => s.ecosystemId === selectedLineageId).map((s) => s.id)
    );
    for (const r of state.relations) {
      if (baseIds.has(r.from) || baseIds.has(r.to)) {
        baseIds.add(r.from);
        baseIds.add(r.to);
      }
    }
    isolatedSet = baseIds;
    visiblePapers = state.sources.filter((s) => baseIds.has(s.id));
  }

  const visiblePaperIds = new Set(visiblePapers.map((p) => p.id));
  if ($('#btnShowAllLineages')) {
    $('#btnShowAllLineages').hidden = selectedLineageId === 'all' && !isolatedFocusNodeId;
  }
  $('#btnIsolateSelectedNode')?.classList.toggle('active', Boolean(isolatedFocusNodeId));

  const sortedPapers = [...visiblePapers].sort((a, b) => (a.year || 2024) - (b.year || 2024));
  const ecoOrder = new Map(state.ecosystems.map((e, idx) => [e.id, idx]));

  sortedPapers.forEach((paper, idx) => {
    const ecoObj = state.ecosystems.find((e) => e.id === paper.ecosystemId);
    const isAttacker = state.relations.some(
      (r) => r.from === paper.id && (r.type === 'refute' || r.type === 'conflict')
    );

    let x = 0,
      y = 0,
      z = 0;

    const total = Math.max(1, sortedPapers.length - 1);
    const progress = sortedPapers.length === 1 ? 0 : (idx / total - 0.5) * 2;

    if (isolatedFocusNodeId && paper.id === isolatedFocusNodeId) {
      x = 0;
      y = 0;
      z = 0;
    } else if (layoutMode === 'lineage') {
      const ecoIdx = ecoOrder.get(paper.ecosystemId) ?? 0;
      const ecoDepthOffset = selectedLineageId === 'all' ? (ecoIdx - 1) * 2.2 : 0;

      x = progress * 4.2 * spreadFactor;
      if (isAttacker) {
        y = (-1.95 - (idx % 2) * 0.45) * spreadFactor;
        z = ((idx % 2 === 0 ? 1.45 : -1.45) + ecoDepthOffset * 0.5) * spreadFactor;
      } else {
        y = ((idx % 2 === 0 ? 0.15 : 0.65) - 0.1) * spreadFactor;
        z = (Math.sin(idx * 1.35) * 1.65 + ecoDepthOffset) * spreadFactor;
      }
    } else if (layoutMode === 'helix') {
      const angle = idx * 1.15;
      const radius = (isAttacker ? 3.4 : 2.75) * spreadFactor;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = (isAttacker ? -1.8 : progress * 1.8) * spreadFactor;
    } else {
      if (!forcePositions.has(paper.id)) {
        const angle = idx * 1.7;
        forcePositions.set(paper.id, {
          x: Math.cos(angle) * 3.4 * spreadFactor,
          y: (isAttacker ? -1.8 : (idx % 3 - 1) * 1.2) * spreadFactor,
          z: Math.sin(angle) * 3.4 * spreadFactor,
          vx: 0,
          vy: 0,
          vz: 0,
        });
      }
      const fp = forcePositions.get(paper.id);
      x = fp.x;
      y = fp.y;
      z = fp.z;
    }

    nodes.push({
      id: paper.id,
      type: 'paper',
      isAttacker,
      stratum: isAttacker ? 'upper' : 'middle',
      label: paper.title,
      short: `${shortAuthor(paper)} (${paper.year})`,
      subtitle: paper.title.length > 34 ? paper.title.slice(0, 33) + '…' : paper.title,
      x,
      y,
      z,
      color: isAttacker ? '#ef4444' : ecoObj?.color || '#10b981',
      raw: paper,
    });
  });

  if (showProblems3D) {
    const visibleProblems = state.problems.filter(
      (pr) => selectedLineageId === 'all' || pr.ecosystemId === selectedLineageId
    );
    visibleProblems.forEach((pr, idx) => {
      nodes.push({
        id: pr.id,
        type: 'problem',
        stratum: 'lower',
        label: pr.title,
        short: `⬢ VẤN ĐỀ: ${pr.title.slice(0, 24)}…`,
        x: (idx - (visibleProblems.length - 1) / 2) * 4.0 * spreadFactor,
        y: 2.25 * spreadFactor,
        z: -1.6 * spreadFactor,
        color: '#a855f7',
        raw: pr,
      });
      for (const p of visiblePapers) {
        if (p.problemId === pr.id) {
          edges.push({
            id: `solves-${p.id}-${pr.id}`,
            from: p.id,
            to: pr.id,
            type: 'solves',
            label: 'Giải quyết vấn đề',
          });
        }
      }
    });
  }

  if (showReasoning3D) {
    const activeQ = state.questions.find((q) => q.id === state.activeQuestionId && q.status !== 'retired');
    if (activeQ && Array.isArray(activeQ.reasoningChain)) {
      const steps = activeQ.reasoningChain;
      let prevId = null;
      steps.forEach((st, sIdx) => {
        const sx = (sIdx - (steps.length - 1) / 2) * 3.1 * spreadFactor;
        nodes.push({
          id: st.id,
          type: 'step',
          stratum: 'middle',
          label: `Bước ${sIdx + 1}: ${st.title}`,
          short: `⛓ B${sIdx + 1}: ${st.title.slice(0, 22)}…`,
          x: sx,
          y: -1.1 * spreadFactor,
          z: 2.35 * spreadFactor,
          color: st.status === 'broken' ? '#ef4444' : st.status === 'contested' ? '#f59e0b' : '#38bdf8',
          raw: { ...st, questionId: activeQ.id, stepIndex: sIdx + 1 },
        });
        if (prevId) {
          edges.push({
            id: `chain-${prevId}-${st.id}`,
            from: prevId,
            to: st.id,
            type: 'reasoning',
            label: `Bước ${sIdx}➔${sIdx + 1}`,
          });
        }
        prevId = st.id;
        for (const pid of st.linkedPaperIds || []) {
          if (visiblePaperIds.has(pid)) {
            edges.push({
              id: `step-link-${st.id}-${pid}`,
              from: pid,
              to: st.id,
              type: st.status === 'broken' ? 'refute' : 'support',
              label: st.status === 'broken' ? 'Bác bỏ bước này' : 'Chứng minh bước này',
            });
          }
        }
      });
    }
  }

  for (const rel of state.relations) {
    if (visiblePaperIds.has(rel.from) && visiblePaperIds.has(rel.to)) {
      edges.push({
        id: rel.id,
        from: rel.from,
        to: rel.to,
        type: rel.type,
        label: rel.label,
        conditionNote: rel.conditionNote,
        raw: rel,
      });
    }
  }

  if (layoutMode !== 'force') {
    relaxNodePositions3D(nodes, 2.55 * spreadFactor);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const gaps = computeEcosystemGaps(selectedLineageId, isolatedSet);
  if (showGaps3D) {
    gaps.forEach((gap, gIdx) => {
      const linked = (gap.paperIds || []).map((id) => nodeMap.get(id)).filter(Boolean);
      if (!linked.length) return;
      const avgX = linked.reduce((s, n) => s + n.x, 0) / linked.length;
      const avgZ = linked.reduce((s, n) => s + n.z, 0) / linked.length;

      const gapNode = {
        id: gap.id,
        type: 'gap',
        stratum: 'lower',
        label: gap.title,
        short: `◇ KHE HỞ: ${gap.title.replace(/^Khe hở:\s*/, '').slice(0, 25)}…`,
        x: avgX + (gIdx % 2 === 0 ? 0.55 : -0.55) * spreadFactor,
        y: (1.75 + (gIdx % 2) * 0.4) * spreadFactor,
        z: avgZ + 0.85 * spreadFactor,
        color: '#ec4899',
        raw: gap,
      };
      nodes.push(gapNode);
      nodeMap.set(gapNode.id, gapNode);

      for (const pNode of linked) {
        edges.push({
          id: `gap-edge-${pNode.id}-${gap.id}`,
          from: pNode.id,
          to: gap.id,
          type: 'gap',
          label: 'Khe hở nghiên cứu',
        });
      }
    });
  }

  if (showMicro3D && activeNodeId) {
    const focalPaperNode = nodeMap.get(activeNodeId);
    if (focalPaperNode && focalPaperNode.type === 'paper' && Array.isArray(focalPaperNode.raw.internalChain)) {
      const chain = focalPaperNode.raw.internalChain;
      let prevMicroId = focalPaperNode.id;
      chain.forEach((mc, mIdx) => {
        const angle = (mIdx / Math.max(1, chain.length)) * Math.PI * 2;
        const rOrbit = 1.65 * spreadFactor;
        const microId = `micro-${focalPaperNode.id}-${mIdx}`;
        nodes.push({
          id: microId,
          type: 'micro',
          stratum: 'middle',
          label: `${mc.stage}: ${mc.text}`,
          short: `[${mc.stage}] ${mc.text.slice(0, 22)}…`,
          x: focalPaperNode.x + Math.cos(angle) * rOrbit,
          y: focalPaperNode.y + (mIdx - 1.5) * 0.42,
          z: focalPaperNode.z + Math.sin(angle) * rOrbit,
          color: mc.stage.includes('Điều kiện') ? '#eab308' : '#38bdf8',
          raw: { ...mc, paper: focalPaperNode.raw },
        });
        edges.push({
          id: `micro-e-${prevMicroId}-${microId}`,
          from: prevMicroId,
          to: microId,
          type: mc.stage.includes('Điều kiện') ? 'condition' : 'reasoning',
          label: mc.stage,
        });
        prevMicroId = microId;
      });
    }
  }

  const counts = { lineage: 0, refute: 0, conflict: 0, support: 0, condition: 0, gap: 0 };
  for (const e of edges) {
    if (counts[e.type] !== undefined) counts[e.type]++;
  }
  Object.keys(counts).forEach((k) => {
    const el = $(`#count-${k}`);
    if (el) el.textContent = counts[k];
  });

  if ($('#navNodeCount')) $('#navNodeCount').textContent = nodes.length;
  if ($('#navPaperCount')) $('#navPaperCount').textContent = state.sources.length;
  if ($('#navGapCount')) $('#navGapCount').textContent = computeEcosystemGaps('all', null).length;

  sceneState.sceneNodes = nodes;
  sceneState.sceneEdges = edges.filter(
    (e) => e.type === 'reasoning' || e.type === 'solves' || activeArrowFilters.has(e.type)
  );
}

export function fitCameraToVisibleScene() {
  const { sceneNodes } = sceneState;
  if (!sceneNodes.length || !stage?.clientWidth) return;
  const xs = sceneNodes.map((n) => n.x);
  const ys = sceneNodes.map((n) => n.y);
  const zs = sceneNodes.map((n) => n.z);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const minZ = Math.min(...zs),
    maxZ = Math.max(...zs);

  const span = Math.max(3.8, Math.hypot(maxX - minX, maxY - minY, (maxZ - minZ) * 0.75));
  cam.targetZoom = Math.max(0.48, Math.min(1.32, 7.2 / span));
  const inspectorOpen = !$('#floatingInspector')?.classList.contains('minimized');
  cam.targetPanX = inspectorOpen ? -95 : 0;
  cam.targetPanY = 0;
}

function stepForcePhysics() {
  if (sceneState.layoutMode !== 'force') return;
  const state = getState();
  const papers = state.sources;
  const kRepel = 0.15 * sceneState.spreadFactor;
  const kSpring = 0.024;
  for (let i = 0; i < papers.length; i++) {
    const a = forcePositions.get(papers[i].id);
    if (!a) continue;
    for (let j = i + 1; j < papers.length; j++) {
      const b = forcePositions.get(papers[j].id);
      if (!b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const distSq = Math.max(0.4, dx * dx + dy * dy + dz * dz);
      const f = kRepel / distSq;
      a.vx += dx * f;
      a.vy += dy * f;
      a.vz += dz * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
      b.vz -= dz * f;
    }
  }
  for (const rel of state.relations) {
    const a = forcePositions.get(rel.from);
    const b = forcePositions.get(rel.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dy, dz) || 0.1;
    const targetLen = 3.2 * sceneState.spreadFactor;
    const delta = (dist - targetLen) * kSpring;
    a.vx += (dx / dist) * delta;
    a.vy += (dy / dist) * delta;
    a.vz += (dz / dist) * delta;
    b.vx -= (dx / dist) * delta;
    b.vy -= (dy / dist) * delta;
    b.vz -= (dz / dist) * delta;
  }
  for (const pos of forcePositions.values()) {
    pos.x = Math.max(-8, Math.min(8, pos.x + pos.vx));
    pos.y = Math.max(-5, Math.min(5, pos.y + pos.vy));
    pos.z = Math.max(-6, Math.min(6, pos.z + pos.vz));
    pos.vx *= 0.82;
    pos.vy *= 0.82;
    pos.vz *= 0.82;
  }
}

export function project3D(pt, w, h) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);

  const x1 = pt.x * cy + pt.z * sy;
  const z1 = -pt.x * sy + pt.z * cy;
  const y2 = pt.y * cp - z1 * sp;
  const z2 = pt.y * sp + z1 * cp;

  const fov = 10.5;
  const perspective = fov / Math.max(2.4, fov + z2 * 0.34);
  const baseScale = Math.min(w / 10.2, h / 6.6) * cam.zoom * perspective;

  return {
    x: w / 2 + cam.panX + x1 * baseScale,
    y: h / 2 + cam.panY + y2 * baseScale,
    depth: z2,
    scale: baseScale,
    perspective,
  };
}

export function resizeCanvas() {
  if (!stage || !canvas || !ctx) return;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw3DVolumetricStage(w, h) {
  const { spreadFactor, darkStage, sceneNodes, activeNodeId } = sceneState;
  ctx.save();
  const gridRadius = 5.4 * spreadFactor;
  const floorY = 2.6 * spreadFactor;

  ctx.strokeStyle = darkStage ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.12)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const pos = (i / 4) * gridRadius;
    const p1 = project3D({ x: pos, y: floorY, z: -gridRadius * 0.7 }, w, h);
    const p2 = project3D({ x: pos, y: floorY, z: gridRadius * 0.7 }, w, h);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const p3 = project3D({ x: -gridRadius, y: floorY, z: pos * 0.7 }, w, h);
    const p4 = project3D({ x: gridRadius, y: floorY, z: pos * 0.7 }, w, h);
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.stroke();
  }

  const strata = [
    { y: -2.0 * spreadFactor, color: 'rgba(239, 68, 68, 0.14)' },
    { y: 0.25 * spreadFactor, color: 'rgba(99, 102, 241, 0.14)' },
    { y: 2.0 * spreadFactor, color: 'rgba(236, 72, 153, 0.14)' },
  ];

  strata.forEach((st) => {
    ctx.strokeStyle = st.color;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    const corners = [
      project3D({ x: -gridRadius * 0.9, y: st.y, z: -gridRadius * 0.55 }, w, h),
      project3D({ x: gridRadius * 0.9, y: st.y, z: -gridRadius * 0.55 }, w, h),
      project3D({ x: gridRadius * 0.9, y: st.y, z: gridRadius * 0.55 }, w, h),
      project3D({ x: -gridRadius * 0.9, y: st.y, z: gridRadius * 0.55 }, w, h),
    ];
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  });

  for (const n of sceneNodes) {
    if (n.type === 'micro') continue;
    const pNode = project3D(n, w, h);
    const pBase = project3D({ x: n.x, y: floorY, z: n.z }, w, h);
    ctx.strokeStyle =
      n.id === activeNodeId
        ? 'rgba(129, 140, 248, 0.45)'
        : darkStage
        ? 'rgba(148, 163, 184, 0.13)'
        : 'rgba(100, 116, 139, 0.16)';
    ctx.lineWidth = n.id === activeNodeId ? 1.5 : 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pNode.x, pNode.y);
    ctx.lineTo(pBase.x, pBase.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = darkStage ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.25)';
    ctx.beginPath();
    ctx.arc(pBase.x, pBase.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const gizmoCx = 68;
  const gizmoCy = h - 98;
  const axisLen = 28;
  const axes = [
    { vec: { x: 1, y: 0, z: 0 }, color: '#6366f1', name: 'X' },
    { vec: { x: 0, y: -1, z: 0 }, color: '#ef4444', name: 'Y' },
    { vec: { x: 0, y: 0, z: 1 }, color: '#10b981', name: 'Z' },
  ];
  ctx.fillStyle = darkStage ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.85)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(gizmoCx, gizmoCy, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const cy = Math.cos(cam.yaw),
    sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch),
    sp = Math.sin(cam.pitch);
  axes.forEach((ax) => {
    const rx = ax.vec.x * cy + ax.vec.z * sy;
    const rz = -ax.vec.x * sy + ax.vec.z * cy;
    const ry = ax.vec.y * cp - rz * sp;
    const ex = gizmoCx + rx * axisLen;
    const ey = gizmoCy + ry * axisLen;
    ctx.strokeStyle = ax.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gizmoCx, gizmoCy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = ax.color;
    ctx.font = '800 9px Inter, sans-serif';
    ctx.fillText(ax.name, ex + (rx >= 0 ? 4 : -10), ey + (ry >= 0 ? 8 : -4));
  });

  ctx.restore();
}

function drawArrowhead(x, y, angle, color, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 1.45, -size * 0.7);
  ctx.lineTo(-size * 1.05, 0);
  ctx.lineTo(-size * 1.45, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw3DEdge(edge, nodeMap, projMap, w, h) {
  const { spreadFactor, darkStage, activeNodeId, hoveredNodeId } = sceneState;
  const nFrom = nodeMap.get(edge.from);
  const nTo = nodeMap.get(edge.to);
  if (!nFrom || !nTo) return;

  const style = ARROW_TYPES[edge.type] || ARROW_TYPES.support;
  const color = darkStage ? style.color : style.lightColor;

  const mid3D = {
    x: (nFrom.x + nTo.x) / 2,
    y: (nFrom.y + nTo.y) / 2 - Math.abs(style.curveHeight || 0.25) * 0.9 * spreadFactor,
    z: (nFrom.z + nTo.z) / 2 + (edge.type === 'refute' ? 0.45 : -0.25) * spreadFactor,
  };

  const pA = projMap.get(edge.from);
  const pB = projMap.get(edge.to);
  const pMid = project3D(mid3D, w, h);

  const isHighlighted =
    activeNodeId === edge.from ||
    activeNodeId === edge.to ||
    hoveredNodeId === edge.from ||
    hoveredNodeId === edge.to;

  ctx.save();
  ctx.globalAlpha = isHighlighted ? 1.0 : 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = isHighlighted ? 2.8 : edge.type === 'refute' || edge.type === 'lineage' ? 2.2 : 1.7;
  ctx.setLineDash(style.dash || []);

  ctx.beginPath();
  ctx.moveTo(pA.x, pA.y);
  ctx.quadraticCurveTo(pMid.x, pMid.y, pB.x, pB.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const t = 0.84;
  const tipX = (1 - t) * (1 - t) * pA.x + 2 * (1 - t) * t * pMid.x + t * t * pB.x;
  const tipY = (1 - t) * (1 - t) * pA.y + 2 * (1 - t) * t * pMid.y + t * t * pB.y;
  const dx = 2 * (1 - t) * (pMid.x - pA.x) + 2 * t * (pB.x - pMid.x);
  const dy = 2 * (1 - t) * (pMid.y - pA.y) + 2 * t * (pB.y - pMid.y);
  drawArrowhead(tipX, tipY, Math.atan2(dy, dx), color, isHighlighted ? 8.5 : 7);

  if (style.bidirectional) {
    const t2 = 0.16;
    const tip2X = (1 - t2) * (1 - t2) * pA.x + 2 * (1 - t2) * t2 * pMid.x + t2 * t2 * pB.x;
    const tip2Y = (1 - t2) * (1 - t2) * pA.y + 2 * (1 - t2) * t2 * pMid.y + t2 * t2 * pB.y;
    const dx2 = 2 * (1 - t2) * (pMid.x - pA.x) + 2 * t2 * (pB.x - pMid.x);
    const dy2 = 2 * (1 - t2) * (pMid.y - pA.y) + 2 * t2 * (pB.y - pMid.y);
    drawArrowhead(tip2X, tip2Y, Math.atan2(-dy2, -dx2), color, 6.5);
  }

  if (style.particles) {
    const pt = ((animTick * (style.particleSpeed || 0.005) * 60) % 1 + 1) % 1;
    const px = (1 - pt) * (1 - pt) * pA.x + 2 * (1 - pt) * pt * pMid.x + pt * pt * pB.x;
    const py = (1 - pt) * (1 - pt) * pA.y + 2 * (1 - pt) * pt * pMid.y + pt * pt * pB.y;
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 9;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(px, py, isHighlighted ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const mx = 0.25 * pA.x + 0.5 * pMid.x + 0.25 * pB.x;
  const my = 0.25 * pA.y + 0.5 * pMid.y + 0.25 * pB.y;
  const showFullLabel = isHighlighted && edge.label;
  const badgeText = showFullLabel
    ? `${style.short}: ${edge.label.length > 34 ? edge.label.slice(0, 33) + '…' : edge.label}`
    : style.short;

  ctx.font = `${isHighlighted ? '700' : '600'} ${isHighlighted ? 10 : 9}px Inter, sans-serif`;
  const tw = ctx.measureText(badgeText).width;
  ctx.fillStyle = darkStage ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = isHighlighted ? 1.4 : 0.9;
  ctx.beginPath();
  ctx.roundRect(mx - tw / 2 - 5, my - 8, tw + 10, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, mx, my);

  ctx.restore();
}

function draw3DNode(node, p) {
  const { activeNodeId, hoveredNodeId, isolatedFocusNodeId, darkStage } = sceneState;
  const isSelected = node.id === activeNodeId;
  const isHovered = node.id === hoveredNodeId;
  const isFocalIsolated = node.id === isolatedFocusNodeId;

  ctx.save();
  const baseRadius =
    node.type === 'paper'
      ? 15
      : node.type === 'gap'
      ? 13.5
      : node.type === 'step'
      ? 11.5
      : node.type === 'problem'
      ? 12.5
      : 7.5;
  const r = baseRadius * Math.max(0.75, Math.min(1.4, p.perspective)) + (isSelected ? 3 : 0);

  if (isSelected || isHovered || isFocalIsolated || node.type === 'gap') {
    ctx.shadowBlur = isSelected ? 26 : 16;
    ctx.shadowColor = node.color;
  }

  if (node.type === 'gap') {
    const pulse = 1 + Math.sin(animTick * 0.08) * 0.14;
    const gr = r * pulse;
    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - gr);
    ctx.lineTo(p.x + gr, p.y);
    ctx.lineTo(p.x, p.y + gr);
    ctx.lineTo(p.x - gr, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (node.type === 'problem') {
    ctx.fillStyle = node.color;
    ctx.strokeStyle = '#f3e8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const hx = p.x + Math.cos(a) * r;
      const hy = p.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (node.type === 'step') {
    ctx.fillStyle = node.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(p.x - r * 1.2, p.y - r * 0.85, r * 2.4, r * 1.7, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, node.color);
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#ffffff' : node.isAttacker ? '#fca5a5' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = isSelected ? 3 : 1.8;
    ctx.stroke();

    if (node.type === 'paper' && (node.raw.conditions?.length || 0) > 0) {
      ctx.strokeStyle = node.isAttacker ? 'rgba(239, 68, 68, 0.7)' : 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r + 5.5, (r + 5.5) * 0.48, -0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;

  const titleText = node.short;
  const subText = node.subtitle || '';
  ctx.font = `700 ${isSelected ? 11.5 : 10.5}px Inter, sans-serif`;
  const w1 = ctx.measureText(titleText).width;
  ctx.font = '500 9.5px Inter, sans-serif';
  const w2 = subText ? ctx.measureText(subText).width : 0;
  const boxW = Math.max(w1, w2) + 14;
  const boxH = subText ? 34 : 20;
  const bx = p.x - boxW / 2;
  const by = p.y + r + 7;

  ctx.fillStyle = isSelected
    ? 'rgba(79, 70, 229, 0.95)'
    : node.isAttacker
    ? 'rgba(127, 29, 29, 0.92)'
    : node.type === 'gap'
    ? 'rgba(131, 24, 67, 0.92)'
    : darkStage
    ? 'rgba(15, 23, 42, 0.88)'
    : 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = isSelected
    ? '#a5b4fc'
    : node.isAttacker
    ? '#f87171'
    : node.type === 'gap'
    ? '#f472b6'
    : darkStage
    ? 'rgba(148, 163, 184, 0.32)'
    : 'rgba(203, 213, 225, 0.95)';
  ctx.lineWidth = isSelected ? 1.6 : 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${isSelected ? 11 : 10}px Inter, sans-serif`;
  ctx.fillStyle = isSelected || darkStage || node.isAttacker || node.type === 'gap' ? '#ffffff' : '#0f172a';
  ctx.fillText(titleText, p.x, by + 10);

  if (subText) {
    ctx.font = '500 9.5px Inter, sans-serif';
    ctx.fillStyle = isSelected ? '#e0e7ff' : node.isAttacker ? '#fecaca' : darkStage ? '#cbd5e1' : '#475569';
    ctx.fillText(subText, p.x, by + 24);
  }

  ctx.restore();
}

function render3DLoop() {
  animTick++;
  if (sceneState.autoOrbit && !dragState) {
    cam.targetYaw += 0.0055;
  }

  cam.yaw += (cam.targetYaw - cam.yaw) * 0.14;
  cam.pitch += (cam.targetPitch - cam.pitch) * 0.14;
  cam.zoom += (cam.targetZoom - cam.zoom) * 0.16;
  cam.panX += (cam.targetPanX - cam.panX) * 0.16;
  cam.panY += (cam.targetPanY - cam.panY) * 0.16;

  if (sceneState.layoutMode === 'force') {
    stepForcePhysics();
    buildSceneGraph();
  }

  if (sceneState.currentView === 'explore' && ctx && stage?.clientWidth > 0) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    ctx.clearRect(0, 0, w, h);

    draw3DVolumetricStage(w, h);

    const nodeMap = new Map(sceneState.sceneNodes.map((n) => [n.id, n]));
    const projMap = new Map(sceneState.sceneNodes.map((n) => [n.id, project3D(n, w, h)]));

    for (const edge of sceneState.sceneEdges) {
      draw3DEdge(edge, nodeMap, projMap, w, h);
    }

    const sorted = [...sceneState.sceneNodes].sort((a, b) => projMap.get(b.id).depth - projMap.get(a.id).depth);
    for (const node of sorted) {
      draw3DNode(node, projMap.get(node.id));
    }
  }

  requestAnimationFrame(render3DLoop);
}

function hitTest3D(mx, my) {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  let best = null;
  let bestDist = 28;
  for (const n of sceneState.sceneNodes) {
    const p = project3D(n, w, h);
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

function handle3DLinkNodeClick(hitNode) {
  const state = getState();
  const { linkModeState } = sceneState;
  if (hitNode.type !== 'paper') {
    notify('Hãy chọn một nút Bài báo.');
    return;
  }
  if (!linkModeState.fromNodeId) {
    linkModeState.fromNodeId = hitNode.id;
    notify(`Đã chọn nguồn "${hitNode.short}". Click tiếp bài báo đích!`);
    return;
  }
  if (linkModeState.fromNodeId === hitNode.id) return;
  const relType = prompt(
    'Nhập loại mũi tên (lineage = Kế thừa, refute = Tấn công/Bác bỏ, conflict = Tương khắc, support = Hỗ trợ):',
    'refute'
  );
  const validType = ARROW_TYPES[relType] ? relType : 'lineage';
  const note =
    prompt('Ghi chú trên mũi tên (VD: Tấn công giả định nhiễu độc lập):', '') || ARROW_TYPES[validType].label;
  state.relations.push({
    id: `rel-${crypto.randomUUID().slice(0, 6)}`,
    from: linkModeState.fromNodeId,
    to: hitNode.id,
    type: validType,
    label: note,
    conditionNote: note,
  });
  linkModeState.active = false;
  linkModeState.fromNodeId = null;
  $('#linkModeBanner').hidden = true;
  saveState();
  buildSceneGraph();
  notify('Đã tạo mũi tên 3D mới!');
}

function setActiveViewpointBtn(btnId) {
  ['#camViewPerspective', '#camViewFront', '#camViewTop', '#camViewSide'].forEach((id) => {
    $(id)?.classList.toggle('active', id === btnId);
  });
}

export function initSpatial3DEngine({ onNodeSelected }) {
  canvas = $('#graphCanvas');
  stage = $('#graphStage');
  ctx = canvas.getContext('2d');
  onSelectionChangeCallback = onNodeSelected;

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest3D(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      if (sceneState.linkModeState.active) {
        handle3DLinkNodeClick(hit);
        return;
      }
      sceneState.activeNodeId = hit.id;
      $('#floatingInspector')?.classList.remove('minimized');
      if (sceneState.showMicro3D) buildSceneGraph();
      if (onSelectionChangeCallback) onSelectionChangeCallback();
      return;
    }
    if (sceneState.autoOrbit) {
      sceneState.autoOrbit = false;
      $('#btnAutoOrbit')?.classList.remove('active');
    }
    dragState = {
      mode: e.shiftKey || e.button === 2 ? 'pan' : 'orbit',
      startX: e.clientX,
      startY: e.clientY,
      startYaw: cam.targetYaw,
      startPitch: cam.targetPitch,
      startPanX: cam.targetPanX,
      startPanY: cam.targetPanY,
    };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest3D(e.clientX - rect.left, e.clientY - rect.top);
    if (hit && hit.type === 'paper') {
      if (sceneState.isolatedFocusNodeId === hit.id) {
        sceneState.isolatedFocusNodeId = null;
        notify('Đã thoát chế độ cô lập bài đơn lẻ, quay về Phả hệ.');
      } else {
        sceneState.isolatedFocusNodeId = hit.id;
        sceneState.activeNodeId = hit.id;
        notify(`🎯 Đã cô lập Phả hệ của "${hit.short}": Chỉ hiện bài con kế thừa và các bài tấn công/bác bỏ nó!`);
      }
      buildSceneGraph();
      fitCameraToVisibleScene();
      if (onSelectionChangeCallback) onSelectionChangeCallback();
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest3D(e.clientX - rect.left, e.clientY - rect.top);
    sceneState.hoveredNodeId = hit?.id || null;
    canvas.style.cursor = dragState
      ? 'grabbing'
      : hit
      ? 'pointer'
      : sceneState.linkModeState.active
      ? 'crosshair'
      : 'grab';

    if (dragState) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (dragState.mode === 'pan') {
        cam.targetPanX = dragState.startPanX + dx;
        cam.targetPanY = dragState.startPanY + dy;
      } else {
        cam.targetYaw = dragState.startYaw + dx * 0.0085;
        cam.targetPitch = Math.max(-1.52, Math.min(1.52, dragState.startPitch + dy * 0.0085));
      }
    }
  });

  canvas.addEventListener('pointerup', () => (dragState = null));
  canvas.addEventListener('pointercancel', () => (dragState = null));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cam.targetZoom = Math.max(0.38, Math.min(2.6, cam.targetZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    },
    { passive: false }
  );

  // Camera Viewpoint Rail Buttons
  $('#camViewPerspective')?.addEventListener('click', () => {
    cam.targetYaw = -0.52;
    cam.targetPitch = 0.34;
    setActiveViewpointBtn('#camViewPerspective');
    fitCameraToVisibleScene();
    notify('🧊 Góc nhìn Khối 3D: Quan sát đồng thời 3 tầng (Tấn công - Kế thừa - Khe hở).');
  });

  $('#camViewFront')?.addEventListener('click', () => {
    cam.targetYaw = 0;
    cam.targetPitch = 0.02;
    setActiveViewpointBtn('#camViewFront');
    fitCameraToVisibleScene();
    notify('👁 Góc Chính diện (X-Y): Nhìn thẳng sự phân tầng giữa bài Tấn công (trên) và bài Gốc (giữa).');
  });

  $('#camViewTop')?.addEventListener('click', () => {
    cam.targetYaw = 0;
    cam.targetPitch = 1.48;
    setActiveViewpointBtn('#camViewTop');
    fitCameraToVisibleScene();
    notify('⬇ Góc Từ Đỉnh (X-Z): Nhìn toàn cảnh độ mở rộng các nhánh từ trên xuống.');
  });

  $('#camViewSide')?.addEventListener('click', () => {
    cam.targetYaw = -1.57;
    cam.targetPitch = 0.12;
    setActiveViewpointBtn('#camViewSide');
    fitCameraToVisibleScene();
    notify('➡ Góc Cắt ngang (Z-Y): Nhìn xuyên theo chiều sâu của các nhánh nghiên cứu.');
  });

  $('#btnAutoOrbit')?.addEventListener('click', (e) => {
    sceneState.autoOrbit = !sceneState.autoOrbit;
    e.currentTarget.classList.toggle('active', sceneState.autoOrbit);
    notify(
      sceneState.autoOrbit
        ? '↻ Đang tự động xoay 360° quanh khối 3D (Click vào không gian để dừng).'
        : 'Đã dừng xoay tự động.'
    );
  });

  // Bottom HUD Controls
  $$('.arrow-chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      const k = chip.dataset.relation;
      if (sceneState.activeArrowFilters.has(k)) {
        sceneState.activeArrowFilters.delete(k);
        chip.classList.remove('active');
      } else {
        sceneState.activeArrowFilters.add(k);
        chip.classList.add('active');
      }
      buildSceneGraph();
    })
  );

  $$('.layout-pill').forEach((pill) =>
    pill.addEventListener('click', () => {
      sceneState.layoutMode = pill.dataset.layout;
      $$('.layout-pill').forEach((p) => p.classList.toggle('active', p === pill));
      buildSceneGraph();
      fitCameraToVisibleScene();
    })
  );

  $('#btnSpreadMore')?.addEventListener('click', () => {
    sceneState.spreadFactor = sceneState.spreadFactor >= 2.2 ? 1.25 : sceneState.spreadFactor + 0.3;
    buildSceneGraph();
    fitCameraToVisibleScene();
    notify(`Độ giãn cách không gian 3D: ${Math.round(sceneState.spreadFactor * 100)}%`);
  });

  $('#fitGraph')?.addEventListener('click', () => fitCameraToVisibleScene());
  $('#resetGraph')?.addEventListener('click', () => {
    cam.targetYaw = -0.52;
    cam.targetPitch = 0.34;
    setActiveViewpointBtn('#camViewPerspective');
    fitCameraToVisibleScene();
  });
  $('#btnTheme3D')?.addEventListener('click', () => {
    sceneState.darkStage = !sceneState.darkStage;
    stage.classList.toggle('dark-stage', sceneState.darkStage);
  });

  $('#btnStart3DLink')?.addEventListener('click', () => {
    sceneState.linkModeState.active = !sceneState.linkModeState.active;
    sceneState.linkModeState.fromNodeId = null;
    $('#linkModeBanner').hidden = !sceneState.linkModeState.active;
  });
  $('#btnCancelLinkMode')?.addEventListener('click', () => {
    sceneState.linkModeState.active = false;
    sceneState.linkModeState.fromNodeId = null;
    $('#linkModeBanner').hidden = true;
  });

  new ResizeObserver(() => {
    resizeCanvas();
  }).observe(stage);

  resizeCanvas();
  requestAnimationFrame(render3DLoop);
}
