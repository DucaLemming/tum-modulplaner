/* UI rework: Plan. Semester board: columns 1 to 4 (plus "Ohne Semester"), cards, drag and drop on desktop, one column with swipe on phone. */
let uiPlanSel = 1, uiPlanDragged = false;
function uiCardTag(k) {
  if (k.done) return ['abgeschlossen', 'ui-tag-ok'];
  if (k.cat === 'x') return ['Alternative', ''];
  if (k.cat === 'o' || k.cat === 'ou') return ['optional', ''];
  if (k.cat === 'u') return ['Platz offen', 'ui-tag-seat'];
  return null;
}
function uiPlanMenu(k, anchor) {
  const E = [1, 2, 3, 4].filter(s => s !== (PL.module(k.code).state.sem || 0)).map(s => ['Verschieben nach ' + s + '.', () => PL.setSemester(k.code, s)]);
  if (PL.module(k.code).state.sem) E.push(['Ohne Semester', () => PL.setSemester(k.code, 0)]);
  if (k.cat !== 'x') E.push(k.cat === 'o' || k.cat === 'ou' ? ['Zählt', () => PL.setStatus(k.code, 'count')] : ['Optional', () => PL.setStatus(k.code, 'optional')]);
  E.push(['Details', () => uiOpenModule(k.code)]);
  E.push(['Aus Plan entfernen', async () => { if (await uiConfirm(k.code + ' aus dem Plan nehmen?', 'Aus Plan entfernen')) PL.setInPlan(k.code, false); }, 'ui-btn-danger']);
  uiMenuSheet(k.code + ' ' + k.name, E, anchor);
}
function uiPlanCard(k) {
  const tag = uiCardTag(k);
  const card = h('div', { class: 'ui-pcard ui-card' + (k.cat === 'x' || k.cat === 'o' || k.cat === 'ou' ? ' ui-faint' : '') + (k.issue ? ' ui-pcard-issue' : ''), 'data-code': k.code, style: { borderLeftColor: k.color } },
    h('button', { class: 'ui-pcard-main', type: 'button', onclick: () => { if (uiPlanDragged) return; uiOpenModule(k.code); } },
      h('span', { class: 'ui-pcard-top' }, h('span', { class: 'ui-meta', text: k.code }), h('b', { class: 'ui-pcard-ects', text: k.ects + ' ECTS' })),
      h('span', { class: 'ui-pcard-name', text: k.name, title: k.name }),
      tag || k.limited || k.issue || k.block ? h('span', { class: 'ui-row ui-pcard-tags' }, tag ? h('span', { class: 'ui-tag ' + tag[1], text: tag[0] }) : null,
        k.limited ? h('span', { title: 'Teilnehmerzahl begrenzt', text: '🔒' }) : null, k.block ? h('span', { class: 'ui-tag', text: 'Block' }) : null,
        k.issue ? h('span', { class: 'ui-tag ui-tag-bad', text: '⚡' }) : null) : null),
    h('button', { class: 'ui-iconbtn ui-pcard-more', type: 'button', 'aria-label': 'Aktionen für ' + k.code, onclick: e => uiPlanMenu(k, e.currentTarget) }, uiIcon('more', 20)));
  return card;
}
function uiPlanCol(S) {
  const sc = v => Math.min(100, 100 * v / 60).toFixed(2) + '%';
  let x = 0; const seg = (v, cls) => { const el = v ? h('i', { class: cls, style: { left: sc(x), width: sc(v) } }) : null; x += v; return el; };
  const effC = S.effortSure > 36 ? 'var(--bad)' : S.effortSure > 30 ? 'var(--warn)' : 'var(--ok)';
  const head = h('div', { class: 'ui-pcol-h' },
    h('div', { class: 'ui-pcol-t' }, h('b', { text: S.s ? S.s + '. Semester' : 'Ohne Semester' }), S.s ? h('span', { class: 'ui-meta', text: S.label }) : null,
      S.s && !S.pub ? h('span', { class: 'ui-tag', text: 'Vorjahr' }) : null),
    h('div', { class: 'ui-pcol-n' }, h('span', { class: 'ui-pcol-big', text: String(S.E.s) }), h('span', { class: 'ui-meta', text: ' ECTS sicher' }),
      S.E.u ? h('span', { class: 'ui-meta', text: ' · +' + S.E.u + ' Platz offen' }) : null, S.issues ? h('span', { class: 'ui-tag ui-tag-bad', text: '⚡ ' + S.issues }) : null),
    S.s ? h('div', { class: 'ui-pbar2', role: 'img', 'aria-label': S.E.s + ' ECTS sicher von 30' },
      seg(S.E.s, 'ui-p-s'), seg(S.E.u, 'ui-p-u'), seg(S.E.o + S.E.ou, 'ui-p-o'), h('b', { class: 'ui-p-30' })) : null,
    S.s ? h('div', { class: 'ui-effort' }, h('span', { class: 'ui-meta', text: 'Aufwand ≈ ' + Math.round(S.effortSure) + (S.effortAll > S.effortSure + 0.5 ? ' (bis ' + Math.round(S.effortAll) + ')' : '') }),
      h('span', { class: 'ui-meter' }, h('i', { style: { width: sc(S.effortAll), background: effC, opacity: .3 } }), h('i', { style: { width: sc(S.effortSure), background: effC } }))) : null);
  const L = h('div', { class: 'ui-pcol-l' }, S.cards.map(uiPlanCard),
    S.fallbacks.length ? h('div', { class: 'ui-meta ui-pfall', text: 'sonst hier: ' + S.fallbacks.join(', ') }) : null,
    !S.cards.length ? h('p', { class: 'ui-empty', text: S.s ? 'Keine Module.' : '' }) : null);
  return h('section', { class: 'ui-pcol', 'data-sem': String(S.s), 'aria-label': S.s ? S.s + '. Semester' : 'Ohne Semester' }, head, L);
}
function uiPlanDnD(board) {
  if (!(window.matchMedia && matchMedia('(pointer: fine)').matches) || window.innerWidth < 720) return;
  board.addEventListener('pointerdown', e => {
    const card = e.target.closest('.ui-pcard'); if (!card || e.button !== 0 || e.target.closest('.ui-pcard-more')) return;
    const x0 = e.clientX, y0 = e.clientY, code = card.dataset.code; let ghost = null, over = null;
    uiPlanDragged = false;
    const move = ev => {
      if (!ghost) {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
        uiPlanDragged = true; const r = card.getBoundingClientRect();
        ghost = card.cloneNode(true); ghost.classList.add('ui-ghost'); ghost.style.width = r.width + 'px'; document.getElementById('ui').appendChild(ghost); card.classList.add('ui-dragging');
      }
      ghost.style.left = (ev.clientX + 8) + 'px'; ghost.style.top = (ev.clientY + 8) + 'px';
      const el = document.elementFromPoint(ev.clientX, ev.clientY), col = el && el.closest('.ui-pcol');
      if (over && over !== col) over.classList.remove('ui-drop'); over = col; if (col) col.classList.add('ui-drop');
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      if (ghost) { ghost.remove(); card.classList.remove('ui-dragging'); if (over) { over.classList.remove('ui-drop'); const s = +over.dataset.sem; if (s !== +card.closest('.ui-pcol').dataset.sem) PL.setSemester(code, s); } }
      setTimeout(() => { uiPlanDragged = false; }, 0);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
}
uiScreens.plan = {
  render(c) {
    const SS = PL.semesters(), cols = SS.slice(1).concat(SS.slice(0, 1)).filter(S => S.s || S.cards.length);
    const phone = window.innerWidth < 720;
    c.appendChild(uiHead('Plan'));
    if (!SS.some(S => S.cards.length)) {
      c.appendChild(h('div', { class: 'ui-card ui-emptycard' }, h('p', { text: 'Noch keine Module im Plan.' }), h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => uiNav('module') }, 'Module ansehen')));
      return;
    }
    if (phone) {
      if (!cols.some(S => S.s === uiPlanSel)) uiPlanSel = 1;
      c.appendChild(h('div', { class: 'ui-seg ui-plan-seg', role: 'tablist', 'aria-label': 'Semester' }, cols.map(S => h('button', { class: S.s === uiPlanSel ? 'ui-on' : '', type: 'button', role: 'tab', 'aria-selected': String(S.s === uiPlanSel),
        onclick: () => { uiPlanSel = S.s; uiRender(true); } }, S.s ? S.s + '.' : 'ohne'))));
      const col = uiPlanCol0(cols);
      const wrap = h('div', { class: 'ui-board ui-board-one' }, uiPlanCol(col));
      let x0 = null, y0 = null;
      wrap.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
      wrap.addEventListener('pointerup', e => {
        if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
        if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
        const i = cols.indexOf(col), j = i + (dx < 0 ? 1 : -1); if (j >= 0 && j < cols.length) { uiPlanSel = cols[j].s; uiRender(true); }
      });
      c.appendChild(wrap);
      return;
    }
    const board = h('div', { class: 'ui-board' }, cols.map(uiPlanCol));
    uiPlanDnD(board);
    c.appendChild(board);
  }
};
function uiPlanCol0(cols) { return cols.find(S => S.s === uiPlanSel) || cols[0]; }
