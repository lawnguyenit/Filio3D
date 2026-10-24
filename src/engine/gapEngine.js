/**
 * @file src/engine/gapEngine.js
 * @description Bộ máy Phát hiện Khe Hở Nghiên Cứu (Research Gap Engine):
 * - Tự động đối chiếu các cạnh Tấn công/Bác bỏ (`refute`) và Tương khắc (`conflict`) giữa các bài báo.
 * - Tạo ứng viên khe hở từ các quan hệ được ghi nhận trong đồ thị; ứng viên cần được kiểm tra với văn liệu rộng hơn.
 * - Hỗ trợ chuyển đổi bất kỳ Khe hở nào thành Câu hỏi nghiên cứu & Chuỗi suy luận mới khi câu hỏi cũ bị xóa.
 */

import { getState, saveState } from '../store/workspaceStore.js';
import { shortAuthor, notify } from '../utils/dom.js';

export function computeEcosystemGaps(filterEcoId = 'all', isolatedPaperIds = null) {
  const state = getState();
  const gaps = [];
  const papersById = new Map(state.sources.map((p) => [p.id, p]));

  for (const rel of state.relations) {
    if (rel.type === 'refute' || rel.type === 'conflict') {
      const pA = papersById.get(rel.from);
      const pB = papersById.get(rel.to);
      if (!pA || !pB) continue;
      if (filterEcoId !== 'all' && pA.ecosystemId !== filterEcoId && pB.ecosystemId !== filterEcoId) continue;
      if (isolatedPaperIds && (!isolatedPaperIds.has(pA.id) || !isolatedPaperIds.has(pB.id))) continue;

      const condA =
        (pA.conditions || []).map((c) => `${c.factor}: ${c.value}`).join('; ') || 'Điều kiện của bài tấn công';
      const condB =
        (pB.conditions || []).map((c) => `${c.factor}: ${c.value}`).join('; ') || 'Điều kiện của bài gốc';

      gaps.push({
        id: `gap-${rel.id}`,
        kind: rel.type === 'refute' ? 'Ứng viên khe hở sau quan hệ bác bỏ' : 'Ứng viên khe hở từ quan hệ tương khắc',
        title: `Ứng viên khe hở: xem xét điểm gãy giữa ${shortAuthor(pA)} (${pA.year}) & ${shortAuthor(pB)} (${pB.year})`,
        summary: `Quan hệ ${rel.type} trong đồ thị hiện tại cho thấy ${shortAuthor(pA)} (${pA.year}) ${
          rel.type === 'refute' ? 'tấn công/bác bỏ' : 'chỉ ra sự tương khắc với'
        } ${shortAuthor(pB)} (${pB.year}): "${rel.label}". Đây là tín hiệu để kiểm tra liệu có thể giữ ưu điểm của ${shortAuthor(
          pB
        )} trong điều kiện được nêu ở ${shortAuthor(pA)} hay không.`,
        missingCondition: `Miền điều kiện cần kiểm tra: kết hợp [${condB}] trong bối cảnh [${condA}] (${pA.limitations || pB.limitations || ''}).`,
        paperIds: [pA.id, pB.id],
        ecosystemId: pA.ecosystemId || pB.ecosystemId,
        suggestedQuestion: `Liệu có thể bảo toàn hiệu năng của ${shortAuthor(pB)} (${pB.year}) trong điều kiện "${rel.conditionNote || rel.label}" được nêu ở ${shortAuthor(pA)} (${pA.year})?`,
      });
    }
  }
  return gaps;
}

export function promoteGapToQuestion(gap, onPromoted) {
  const state = getState();
  const newQ = {
    id: `q-${crypto.randomUUID().slice(0, 6)}`,
    title: gap.suggestedQuestion,
    hypothesis: gap.missingCondition,
    status: 'active',
    ecosystemId: gap.ecosystemId,
    createdAt: Date.now(),
    reasoningChain: [
      {
        id: `st-${crypto.randomUUID().slice(0, 5)}`,
        stepOrder: 1,
        title: 'Kế thừa bài báo gốc & điều kiện biên',
        description: gap.summary,
        status: 'conditional',
        linkedPaperIds: gap.paperIds,
      },
      {
        id: `st-${crypto.randomUUID().slice(0, 5)}`,
        stepOrder: 2,
        title: 'Giải quyết miền điều kiện bị khuyết',
        description: gap.missingCondition,
        status: 'solid',
        linkedPaperIds: gap.paperIds,
      },
    ],
  };

  state.questions.unshift(newQ);
  state.activeQuestionId = newQ.id;
  saveState();
  notify('✦ Đã tạo Câu hỏi nghiên cứu mới từ Khe hở và bật tầng Chuỗi suy luận 3D!');
  if (typeof onPromoted === 'function') {
    onPromoted(newQ);
  }
}
