/* UI rework: DOM helper and formatting. h(tag, attrs, ...children) builds one element. */
const UI_PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'open']);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (UI_PROPS.has(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  const add = c => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return e;
}
const uiFmt = {
  num: (v, d) => (d ? Number(v).toFixed(d) : String(Math.round(v))).replace('.', ','),
  hours: v => uiFmt.num(v, 1) + ' h',
  date: iso => { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' : iso; },
  dateY: iso => { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; },
  wd: n => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][n] || '',
  time: m => m == null ? '' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
  sem: s => s ? s + '. Sem.' : 'Ohne Semester'
};
const UI_ICON = {
  uebersicht: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
  module: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plan: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z"/>',
  woche: '<path d="M4 5h16v15H4zM4 9h16M9 3v4M15 3v4"/>',
  pruefungen: '<path d="M6 3h9l3 3v15H6zM9 11h6M9 15h6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/>',
  chev: '<path d="M9 5l7 7-7 7"/>'
};
function uiIcon(name, size) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 24); s.setAttribute('height', size || 24);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = UI_ICON[name] || ''; return s;
}
/* seat state of a limited module: voll / teils voll / N frei / erhalten */
function uiSeatTag(seat) {
  if (!seat) return null;
  if (seat.got) return h('span', { class: 'ui-tag ui-seat ui-seat-got' }, '🔒 Platz erhalten');
  return h('span', { class: 'ui-tag ui-seat ui-seat-' + seat.state }, '🔒 ' + seat.text);
}
/* horizontal swipe on touch screens (vertical scrolling stays with the browser) */
function uiSwipe(el, onNext, onPrev) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { if (e.touches.length !== 1) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    if (dx < 0) onNext(); else onPrev();
  }, { passive: true });
  el.addEventListener('touchcancel', () => { x0 = null; }, { passive: true });
}
