/* UI rework: bottom sheets, popovers, dialogs, confirm, focus trap; module panel container. */
const uiSheetStack = [];
const UI_FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';
function uiSheet(title, content, opts) {
  opts = opts || {};
  const kind = opts.kind || 'bottom', root = uiSheetRoot(), prev = document.activeElement;
  const wide = window.innerWidth >= 720;
  const box = h('div', { class: 'ui-sheet ui-sheet-' + kind + (wide ? ' ui-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog', tabindex: '-1' },
    h('div', { class: 'ui-sheet-head' }, h('h2', { class: 'ui-sheet-title', text: title || '' }),
      h('button', { class: 'ui-iconbtn ui-sheet-x', type: 'button', 'aria-label': 'Schließen', onclick: () => close() }, uiIcon('close', 20))),
    h('div', { class: 'ui-sheet-body' }, content));
  const wrap = h('div', { class: 'ui-sheet-wrap' }, h('div', { class: 'ui-backdrop', onclick: () => close() }), box);
  root.appendChild(wrap);
  if (kind === 'popover' && wide && opts.anchor) {
    const r = opts.anchor.getBoundingClientRect(), W = Math.min(380, window.innerWidth - 24);
    box.style.width = W + 'px';
    let left = r.right + 8; if (left + W > window.innerWidth - 12) left = Math.max(12, r.left - W - 8);
    box.style.left = left + 'px';
    const hh = box.offsetHeight; let top = Math.min(r.top, window.innerHeight - hh - 12); box.style.top = Math.max(12, top) + 'px';
  }
  let closed = false;
  const entry = { close, box };
  function close(v) {
    if (closed) return; closed = true;
    wrap.remove(); const i = uiSheetStack.indexOf(entry); if (i >= 0) uiSheetStack.splice(i, 1);
    if (opts.onClose) try { opts.onClose(v); } catch (e) { console.error(e); }
    if (prev && prev.focus && document.contains(prev)) try { prev.focus(); } catch (e) {}
  }
  uiSheetStack.push(entry);
  const f = box.querySelector('.ui-sheet-body ' + UI_FOCUSABLE.split(',').join(', .ui-sheet-body ')) || box;
  setTimeout(() => { try { (opts.focus || f).focus(); } catch (e) {} }, 0);
  return close;
}
function uiTopSheet() { return uiSheetStack[uiSheetStack.length - 1] || null; }
function uiTrapKey(e) {
  const top = uiTopSheet();
  if (top) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); top.close(); return; }
    if (e.key === 'Tab') {
      const L = [...top.box.querySelectorAll(UI_FOCUSABLE)].filter(x => x.offsetParent !== null);
      if (!L.length) { e.preventDefault(); return; }
      const i = L.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); L[L.length - 1].focus(); }
      else if (!e.shiftKey && (i === L.length - 1 || i < 0)) { e.preventDefault(); L[0].focus(); }
    }
    return;
  }
  if (e.key === 'Escape' && document.body.dataset.ui === 'new' && uiRoute().module) { e.preventDefault(); e.stopPropagation(); uiCloseModule(); }
}
function uiConfirm(text, okLabel) {
  return new Promise(res => {
    let val = false;
    const body = h('div', { class: 'ui-confirm' }, h('p', { text }),
      h('div', { class: 'ui-actions' },
        h('button', { class: 'ui-btn', type: 'button', onclick: () => { val = false; close(); } }, 'Abbrechen'),
        h('button', { class: 'ui-btn ui-btn-primary ui-confirm-ok', type: 'button', onclick: () => { val = true; close(); } }, okLabel || 'OK')));
    const close = uiSheet('Bestätigen', body, { kind: 'dialog', onClose: () => res(val) });
  });
}
function uiMenuSheet(title, entries, anchor) {
  let close;
  const body = h('div', { class: 'ui-menu', role: 'menu' }, entries.filter(Boolean).map(([lab, f, cls]) =>
    h('button', { class: 'ui-menu-item' + (cls ? ' ' + cls : ''), type: 'button', role: 'menuitem', onclick: () => { close(); f(); } }, lab)));
  close = uiSheet(title, body, { kind: 'popover', anchor });
  return close;
}
/* module panel: docked (desktop), overlay (tablet), full screen (phone) */
function uiRenderPanel(panel, code) {
  panel.innerHTML = '';
  if (!code) { panel.hidden = true; return; }
  panel.hidden = false;
  const body = h('div', { class: 'ui-panel-body' });
  panel.appendChild(h('div', { class: 'ui-panel-bar' },
    h('span', { class: 'ui-panel-code', text: code }),
    h('button', { class: 'ui-iconbtn', type: 'button', 'aria-label': 'Schließen', onclick: () => uiCloseModule() }, uiIcon('close', 22))));
  panel.appendChild(body);
  if (uiScreens.modul) { try { uiScreens.modul.render(body, code); } catch (e) { console.error('Modul', e); } }
  else body.appendChild(h('div', { class: 'ui-modul' }, h('h2', { text: code })));
}
