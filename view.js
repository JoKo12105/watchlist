// Handy-Ansicht: liest data.json (vom PC hochgeladen) und filtert wie die Erweiterung, nur lesend.
(() => {
const OWN = 'Physisch (eigene Sammlung)';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/&/g, ' and ').replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const eur = n => n == null ? '' : n.toFixed(2).replace('.', ',') + ' €';
const dec = (n, d) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const num = n => n == null ? '' : n.toLocaleString('de-DE');
const fmtRuntime = m => m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + ' Min.' : ''}`.trim() : m + ' Min.';
const ls = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

let data = null, films = [];
const prefs = Object.assign({ sel: [], types: ['flat'], sort: 'added', showAll: false }, ls.get('wsf-prefs') || {});
let sel = new Set(prefs.sel), types = new Set(prefs.types && prefs.types.length ? prefs.types : ['flat']);
const savePrefs = () => ls.set('wsf-prefs', { sel: [...sel], types: [...types], sort: $('sort').value, showAll: $('showAll').checked });

function offersOf(f) {
  const out = [];
  if (f.own) out.push({ src: OWN, type: 'own' });
  for (const [p, o] of Object.entries(f.providers || {})) {
    if (o.flat) out.push({ src: p, type: 'flat', tier: o.tier });
    if (o.rent != null) out.push({ src: p, type: 'rent', price: o.rent });
    if (o.buy != null) out.push({ src: p, type: 'buy', price: o.buy });
  }
  return out;
}
const typeOk = o => o.type === 'own' || types.has(o.type);
const matches = f => { const o = offersOf(f).filter(typeOk); return sel.size ? o.some(x => sel.has(x.src)) : o.length > 0; };

function renderChips() {
  const counts = new Map();
  films.forEach(f => { const seen = new Set(); offersOf(f).filter(typeOk).forEach(o => { if (!seen.has(o.src)) { seen.add(o.src); counts.set(o.src, (counts.get(o.src) || 0) + 1); } }); });
  const names = [...new Set([...counts.keys(), ...sel])].filter(n => n !== OWN)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, 'de'));
  // ausgewählte Dienste zuerst, damit sie auf dem schmalen Bildschirm sichtbar bleiben
  names.sort((a, b) => sel.has(b) - sel.has(a));
  $('chips').innerHTML = `<button type="button" class="chip own" data-src="${esc(OWN)}" aria-pressed="${sel.has(OWN)}">Physisch <span class="n">${counts.get(OWN) || 0}</span></button>`
    + names.map(n => `<button type="button" class="chip" data-src="${esc(n)}" aria-pressed="${sel.has(n)}">${esc(n)} <span class="n">${counts.get(n) || 0}</span></button>`).join('');
}

function filmRow(f) {
  const byProv = new Map();
  offersOf(f).forEach(o => { if (o.type === 'own') return; const e = byProv.get(o.src) || {}; e[o.type] = o; byProv.set(o.src, e); });
  const parts = [];
  if (f.own) parts.push(`<span class="o own ${sel.has(OWN) ? 'hit' : ''}">Im Regal</span>`);
  [...byProv.entries()].sort((a, b) => (!!b[1].flat - !!a[1].flat) || a[0].localeCompare(b[0], 'de')).forEach(([p, e]) => {
    const hit = sel.has(p);
    if (e.flat) parts.push(`<span class="o abo ${hit && types.has('flat') ? 'hit' : ''}">${e.flat.tier && norm(e.flat.tier).startsWith(norm(p)) ? esc(e.flat.tier) : esc(p) + (e.flat.tier ? ' · ' + esc(e.flat.tier) : '')}</span>`);
    const pay = [];
    if (e.rent) pay.push(`leihen <span class="p">${eur(e.rent.price)}</span>`);
    if (e.buy) pay.push(`kaufen <span class="p">${eur(e.buy.price)}</span>`);
    if (pay.length) parts.push(`<span class="o pay ${hit && ((e.rent && types.has('rent')) || (e.buy && types.has('buy'))) ? 'hit' : ''}">${esc(p)} · ${pay.join(' · ')}</span>`);
  });
  const m = f.match;
  const de = m && norm(m.title) !== norm(f.name) ? `<small>${esc(m.title)}${m.year && m.year !== f.year ? ' (' + m.year + ')' : ''}</small>` : '';
  let flag = '';
  if (!m && f.error) flag = `<span class="flag">${esc(f.error)}</span>`;
  else if (!m && f.checked) flag = '<span class="flag">nicht auf werstreamt.es</span>';
  else if (m && m.confidence === 'unsicher') flag = '<span class="flag">Zuordnung prüfen</span>';
  const facts = [];
  if (f.year) facts.push(`<span class="yr">${f.year}</span>`);
  if (m && m.kind === 'serie') facts.push('<span class="kind">Serie</span>');
  if (f.runtime) facts.push(`<span>${fmtRuntime(f.runtime)}</span>`);
  if (f.lbRating != null) facts.push(`<span class="rt lb" title="${f.lbCount ? num(f.lbCount) + ' Bewertungen' : ''}"><span class="src">Letterboxd</span><span class="star">★</span><b>${dec(f.lbRating, 1)}</b></span>`);
  if (f.imdbRating != null) facts.push(`<span class="rt imdb" title="${f.imdbVotes ? num(f.imdbVotes) + ' Bewertungen' : ''}"><span class="src">IMDb</span><b>${dec(f.imdbRating, 1)}</b></span>`);
  const links = [];
  if (m && m.url) links.push(`<a href="${esc(m.url)}" target="_blank" rel="noopener">werstreamt.es</a>`);
  if (f.uri && /^https?:/.test(f.uri)) links.push(`<a href="${esc(f.uri)}" target="_blank" rel="noopener">Letterboxd</a>`);
  if (f.imdbId) links.push(`<a href="https://www.imdb.com/title/${esc(f.imdbId)}/" target="_blank" rel="noopener">IMDb</a>`);
  const poster = f.poster ? `<img src="${esc(f.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${f.year || ''}</span>`;
  let offersHtml = parts.join('');
  if (!offersHtml && f.checked && !f.error) offersHtml = '<span class="none">Derzeit kein Angebot in Deutschland</span>';
  return `<article class="film"><div class="poster">${poster}</div><div class="body">
    <div class="ttl">${esc(f.name)} ${de} ${flag}</div>
    ${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}
    <div class="offers">${offersHtml}</div><div class="meta">${links.join('')}</div></div></article>`;
}

function renderList() {
  const q = norm($('q').value), all = $('showAll').checked;
  const rows = films.filter(f => !q || norm(f.name).includes(q) || (f.match && norm(f.match.title).includes(q)));
  const hits = rows.filter(matches);
  const shown = all ? rows.slice() : hits;
  const s = $('sort').value;
  shown.sort((a, b) => {
    if (s === 'title') return a.name.localeCompare(b.name, 'de');
    if (s === 'year-desc') return (b.year || 0) - (a.year || 0);
    if (s === 'year-asc') return (a.year || 9999) - (b.year || 9999);
    if (s === 'count') return offersOf(b).filter(typeOk).length - offersOf(a).filter(typeOk).length;
    if (s === 'lb') return (b.lbRating ?? -1) - (a.lbRating ?? -1);
    if (s === 'imdb') return (b.imdbRating ?? -1) - (a.imdbRating ?? -1);
    if (s === 'runtime') return (a.runtime ?? 9999) - (b.runtime ?? 9999);
    return a.i - b.i;
  });
  $('cnt').textContent = hits.length;
  $('cntTxt').textContent = `von ${films.length} Filmen ${sel.size ? 'bei deiner Auswahl' : 'mit passendem Angebot'}`;
  $('list').innerHTML = shown.length ? shown.map(filmRow).join('')
    : `<div class="empty">${films.length ? 'Keine Treffer. Wähle weitere Dienste oder „Leihen“ und „Kaufen“.' : 'Noch keine Daten.'}</div>`;
}

function renderStand(offline) {
  const el = $('stand');
  if (!data) { el.textContent = offline ? 'Keine Verbindung und noch keine gespeicherten Daten.' : 'Noch keine Daten hochgeladen.'; return; }
  const d = new Date(data.created);
  const days = (Date.now() - d) / 864e5;
  el.textContent = `Stand vom PC: ${d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    + (days >= 3 ? ` · ${Math.floor(days)} Tage alt, Angebote können sich geändert haben` : '') + (offline ? ' · offline' : '');
  el.className = 'stand' + (days >= 3 ? ' old' : '');
}

function render() {
  document.querySelectorAll('#seg button').forEach(b => b.setAttribute('aria-pressed', types.has(b.dataset.type)));
  renderChips(); renderList();
}

function use(d) {
  data = d;
  films = (d.films || []).map((f, i) => ({ i, ...f }));
}

async function load() {
  const cached = ls.get('wsf-data');
  if (cached) { use(cached); renderStand(false); render(); }
  try {
    const r = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!cached || d.created !== cached.created) { ls.set('wsf-data', d); use(d); render(); }
    renderStand(false);
  } catch (e) {
    renderStand(true);
    if (!cached) $('list').innerHTML = '<div class="empty">Die Daten konnten nicht geladen werden. Prüfe die Internetverbindung.</div>';
  }
}

// ---------- Bedienung ----------
$('sort').value = prefs.sort || 'added';
$('showAll').checked = !!prefs.showAll;
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const s = b.dataset.src; sel.has(s) ? sel.delete(s) : sel.add(s); savePrefs(); renderChips(); renderList();
});
$('seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const t = b.dataset.type;
  if (types.has(t) && types.size === 1) return;
  types.has(t) ? types.delete(t) : types.add(t); savePrefs(); render();
});
['q', 'sort', 'showAll'].forEach(id => $(id).addEventListener('input', () => { if (id !== 'q') savePrefs(); renderList(); }));
$('resetSel').onclick = () => { sel.clear(); savePrefs(); render(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
load();
})();
