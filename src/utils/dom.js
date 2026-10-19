/**
 * @file src/utils/dom.js
 * @description Các hàm tiện ích thao tác DOM, hiển thị thông báo Toast, escape HTML và định dạng tên tác giả ngắn gọn.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

let toastTimer = null;
export function notify(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3600);
}

export function shortAuthor(paper) {
  if (!paper) return 'Bài báo';
  if (!paper.authors) return (paper.title || 'Bài báo').slice(0, 18) + '…';
  return paper.authors.split(',')[0].trim();
}
