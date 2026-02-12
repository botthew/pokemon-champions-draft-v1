import { nextPickFromQueue } from './queue.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = 'pcdl_v1_results';
const AUTH_KEY = 'pcdl_v1_auth';
const QUEUE_KEY_PREFIX = 'pcdl_v1_queue_';
const QUEUE_PREF_KEY_PREFIX = 'pcdl_v1_queueprefs_';
const VIEW_PREFS_KEY = 'pcdl_v1_viewprefs';

// Static sprite URLs (no API call needed)
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const ART_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

const pokemonCache = new Map(); // dex -> PokeAPI /pokemon payload

function spriteUrl(dex) {
  return `${SPRITE_BASE}/${dex}.png`;
}

function artworkUrl(dex) {
  return `${ART_BASE}/${dex}.png`;
}

function prettyName(name) {
  return (name || '')
    .split('-')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function renderTypeChips(typesStr) {
  const types = (typesStr || '').split('/').map(t => t.trim().toLowerCase()).filter(Boolean);
  return `<div class="type-chips">${types.map(t => {
    const cls = `type-chip type-${t}`;
    return `<span class="${cls}"><span class="dot"></span>${t}</span>`;
  }).join('')}</div>`;
}

async function fetchPokemon(dex) {
  const key = String(dex);
  if (pokemonCache.has(key)) return pokemonCache.get(key);
  const r = await fetch(`${POKEAPI_BASE}/pokemon/${dex}/`);
  if (!r.ok) throw new Error(`PokeAPI lookup failed for dex=${dex}`);
  const data = await r.json();
  pokemonCache.set(key, data);
  return data;
}

function ensureDialog() {
  const dialog = $('#pokeDialog');
  if (!dialog) throw new Error('Missing #pokeDialog');

  // Close when clicking the backdrop area
  if (!dialog.dataset.bound) {
    dialog.dataset.bound = '1';
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
  return dialog;
}

function renderPokemonDialogLoading(p) {
  return `
    <div class="hd">
      <h3>${prettyName(p.name)} (#${p.dex})</h3>
      <button class="close" id="dlgClose">Close</button>
    </div>
    <div class="bd">
      <div class="row" style="align-items:center; gap:14px">
        <img class="sprite" src="${spriteUrl(p.dex)}" alt="${p.name}" />
        <div>
          <div>${renderTypeChips(p.types)}</div>
          <div style="margin-top:6px"><small>Loading details from PokeAPI…</small></div>
        </div>
      </div>
    </div>
  `;
}

function renderPokemonDialog(p, data) {
  const typesStr = (data.types || []).sort((a,b) => a.slot - b.slot).map(t => t.type.name).join('/');

  const stats = {};
  (data.stats || []).forEach(s => stats[s.stat.name] = s.base_stat);
  const statRows = [
    ['HP', stats['hp']],
    ['Atk', stats['attack']],
    ['Def', stats['defense']],
    ['SpA', stats['special-attack']],
    ['SpD', stats['special-defense']],
    ['Spe', stats['speed']],
  ];
  const bst = statRows.reduce((acc, [,v]) => acc + (Number(v) || 0), 0);

  const abilities = (data.abilities || [])
    .sort((a,b) => a.slot - b.slot)
    .map(a => ({ name: a.ability.name, hidden: a.is_hidden }));

  const moves = (data.moves || []).map(m => {
    const groups = Array.from(new Set((m.version_group_details || []).map(v => v.version_group.name))).sort();
    return { name: m.move.name, groups };
  }).sort((a,b) => a.name.localeCompare(b.name));

  const allGroups = Array.from(new Set(moves.flatMap(m => m.groups))).sort();

  const officialArt = data?.sprites?.other?.['official-artwork']?.front_default || artworkUrl(p.dex);

  const leagueBits = (Number.isFinite(p.points) && p.tier)
    ? `<span class="badge ok">${p.points} pts</span> <span class="badge tier tier-${p.tier}">${p.tier}</span>`
    : '';

  return `
    <div class="hd">
      <h3>${prettyName(p.name)} <span class="badge">#${p.dex}</span></h3>
      <button class="close" id="dlgClose">Close</button>
    </div>
    <div class="bd">
      <div class="poke-hero">
        <img class="art" src="${officialArt}" alt="${p.name}" />
        <div class="meta">
          <div class="name">${prettyName(p.name)}</div>
          <div class="sub">${renderTypeChips(typesStr)}</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center">
            ${leagueBits}
            <span class="badge">BST ${bst}</span>
          </div>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Pokemon details">
        <button class="tabbtn active" data-tab="stats" type="button">Stats</button>
        <button class="tabbtn" data-tab="abilities" type="button">Abilities</button>
        <button class="tabbtn" data-tab="moves" type="button">Moves</button>
      </div>

      <div class="tab active" data-tabpanel="stats" role="tabpanel">
        <div class="card" style="margin:0">
          <h2 style="margin:0 0 10px 0">Base stats</h2>
          <div class="stats">
            ${statRows.map(([k,v]) => `
              <div>
                <div class="kv" style="grid-template-columns:50px 1fr">
                  <div class="k">${k}</div>
                  <div class="v" style="display:flex;gap:10px;align-items:center">
                    <div style="width:32px">${v}</div>
                    <div class="statbar" aria-hidden="true"><div style="width:${Math.min(100, (Number(v)||0)/2)}%"></div></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:10px"><small>BST is displayed above. Stats are from PokeAPI.</small></div>
        </div>
      </div>

      <div class="tab" data-tabpanel="abilities" role="tabpanel">
        <div class="card" style="margin:0">
          <h2 style="margin:0 0 10px 0">Abilities</h2>
          <div class="type-chips">
            ${abilities.map(a => `<span class="badge ${a.hidden ? '' : 'ok'}">${a.name}${a.hidden ? ' (H)' : ''}</span>`).join(' ')}
          </div>
          <div style="margin-top:10px"><small>(H) = Hidden Ability.</small></div>
        </div>
      </div>

      <div class="tab" data-tabpanel="moves" role="tabpanel">
        <div class="card" style="margin:0">
          <h2 style="margin:0 0 10px 0">Moves <span class="badge">${moves.length}</span></h2>
          <div class="row" style="align-items:end">
            <div class="field"><label>Search</label><input id="mvSearch" placeholder="e.g. earthquake" /></div>
            <div class="field"><label>Version group</label>
              <select id="mvGroup">
                <option value="">(any)</option>
                ${allGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
              </select>
            </div>
            <div class="field"><button id="mvReset">Reset</button></div>
          </div>
          <div style="margin-top:10px" class="moves" id="mvList"><small>Open the Moves tab to load the list.</small></div>
          <small>Note: PokeAPI lists moves across many games/versions. Use version-group to narrow it.</small>
        </div>
      </div>
    </div>
  `;
}

function renderMovesList(moves, { q, group }) {
  const qq = (q || '').trim().toLowerCase();
  let filtered = moves;
  if (qq) filtered = filtered.filter(m => m.name.includes(qq));
  if (group) filtered = filtered.filter(m => m.groups.includes(group));

  const shown = filtered.slice(0, 200);
  return `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px">
      <small>Showing ${shown.length} / ${filtered.length}${filtered.length !== moves.length ? ` (filtered from ${moves.length})` : ''}</small>
      ${filtered.length > 200 ? `<small class="badge">(limited to 200 for v1)</small>` : ''}
    </div>
    <ul>
      ${shown.map(m => `<li><code>${m.name}</code></li>`).join('')}
    </ul>
  `;
}

async function openPokemonDialog(p) {
  const dialog = ensureDialog();
  dialog.innerHTML = renderPokemonDialogLoading(p);
  dialog.showModal();
  $('#dlgClose')?.addEventListener('click', () => dialog.close());

  try {
    const data = await fetchPokemon(p.dex);
    dialog.innerHTML = renderPokemonDialog(p, data);
    $('#dlgClose')?.addEventListener('click', () => dialog.close());

    // Tabs
    const tabBtns = $$('#pokeDialog .tabbtn');
    const tabs = $$('#pokeDialog .tab');
    let movesInitialized = false;

    const activateTab = (name) => {
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tabpanel === name));

      if (name === 'moves' && !movesInitialized) {
        movesInitialized = true;
        paint();
      }
    };

    tabBtns.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));

    const moves = (data.moves || []).map(m => {
      const groups = Array.from(new Set((m.version_group_details || []).map(v => v.version_group.name))).sort();
      return { name: m.move.name, groups };
    }).sort((a,b) => a.name.localeCompare(b.name));

    const mvList = $('#mvList');
    const state = { q: '', group: '' };

    function paint() {
      if (!mvList) return;
      mvList.innerHTML = renderMovesList(moves, state);
    }

    const mvSearch = $('#mvSearch');
    const mvGroup = $('#mvGroup');

    mvSearch?.addEventListener('input', (e) => { state.q = e.target.value; if (movesInitialized) paint(); });
    mvGroup?.addEventListener('change', (e) => { state.group = e.target.value; if (movesInitialized) paint(); });
    $('#mvReset')?.addEventListener('click', () => {
      state.q = '';
      state.group = '';
      if (mvSearch) mvSearch.value = '';
      if (mvGroup) mvGroup.value = '';
      if (movesInitialized) paint();
    });

    // default tab
    activateTab('stats');
  } catch (err) {
    dialog.innerHTML = `
      <div class="hd"><h3>${prettyName(p.name)} (#${p.dex})</h3><button class="close" id="dlgClose">Close</button></div>
      <div class="bd"><p><span class="badge danger">Error</span> <small>${err.message}</small></p></div>
    `;
    $('#dlgClose')?.addEventListener('click', () => dialog.close());
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim());
    rows.push(obj);
  }
  return rows;
}

async function loadJson(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return await r.json();
}

async function apiGet(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return await r.json();
}

async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `API error ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadText(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return await r.text();
}

function getResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setResults(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { coach: '', pin: '' };
    return { coach: '', pin: '', ...JSON.parse(raw) };
  } catch {
    return { coach: '', pin: '' };
  }
}

function setAuth(obj) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
}

function getQueue(coach) {
  if (!coach) return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY_PREFIX + coach);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setQueue(coach, queue) {
  if (!coach) return;
  localStorage.setItem(QUEUE_KEY_PREFIX + coach, JSON.stringify(queue || []));
}

function getQueuePrefs(coach) {
  // Billy preference: always STOP if the top queued mon becomes invalid (taken/over-budget).
  // (We keep the storage shape for backward compatibility, but force skipInvalid=false.)
  if (!coach) return { autoDraft: false, skipInvalid: false };
  try {
    const raw = localStorage.getItem(QUEUE_PREF_KEY_PREFIX + coach);
    const obj = JSON.parse(raw || '{}') || {};
    return {
      autoDraft: Boolean(obj.autoDraft),
      skipInvalid: false,
    };
  } catch {
    return { autoDraft: false, skipInvalid: false };
  }
}

function setQueuePrefs(coach, prefs) {
  if (!coach) return;
  localStorage.setItem(QUEUE_PREF_KEY_PREFIX + coach, JSON.stringify(prefs || {}));
}

function getViewPrefs() {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    const obj = JSON.parse(raw || '{}') || {};
    return {
      showFeed: obj.showFeed === false ? false : true,
    };
  } catch {
    return { showFeed: true };
  }
}

function setViewPrefs(prefs) {
  localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs || {}));
}

function defaultMatchKey(m) {
  return `w${m.week}_m${m.match}_${m.coach1}_vs_${m.coach2}`;
}

function computeStandings(coaches, schedule, results) {
  const base = {};
  coaches.forEach(c => base[c] = { coach: c, points: 0, wins: 0, losses: 0, diff: 0, h2h: {} });

  for (const m of schedule) {
    const key = defaultMatchKey(m);
    const res = results[key];
    if (!res) continue;

    const a = m.coach1;
    const b = m.coach2;
    const aw = Number(res.aWins ?? 0);
    const bw = Number(res.bWins ?? 0);

    base[a].points += aw;
    base[b].points += bw;

    base[a].wins += aw;
    base[a].losses += bw;
    base[b].wins += bw;
    base[b].losses += aw;

    base[a].diff += (aw - bw);
    base[b].diff += (bw - aw);

    base[a].h2h[b] = (base[a].h2h[b] ?? 0) + aw;
    base[b].h2h[a] = (base[b].h2h[a] ?? 0) + bw;
  }

  const rows = Object.values(base);

  // total points desc, then head-to-head among tied, then diff
  rows.sort((x, y) => y.points - x.points || y.diff - x.diff || x.coach.localeCompare(y.coach));

  // Head-to-head refinement only within exact points ties.
  const grouped = new Map();
  for (const r of rows) {
    const k = r.points;
    grouped.set(k, [...(grouped.get(k) ?? []), r]);
  }

  const final = [];
  const pointsKeys = Array.from(grouped.keys()).sort((a,b) => b-a);
  for (const pts of pointsKeys) {
    const group = grouped.get(pts);
    if (group.length === 1) {
      final.push(group[0]);
      continue;
    }

    // Compute head-to-head points within the tied group only
    const names = group.map(g => g.coach);
    const h2hScore = (r) => names.reduce((acc, opp) => acc + (opp === r.coach ? 0 : (r.h2h[opp] ?? 0)), 0);

    group.sort((a,b) => h2hScore(b) - h2hScore(a) || b.diff - a.diff || a.coach.localeCompare(b.coach));
    final.push(...group);
  }

  return final.map((r, idx) => ({ ...r, seed: idx + 1 }));
}

function renderHome(cfg) {
  return `
    <div class="card">
      <h2>Quick links</h2>
      <div class="row">
        <div class="field"><a href="#pool">Browse the draft pool</a><small>Filter by type, tier, points.</small></div>
        <div class="field"><a href="#schedule">See the schedule</a><small>Weeks 1–3 round robin.</small></div>
        <div class="field"><a href="#results">Enter results</a><small>Auto-standings + seeds for playoffs.</small></div>
      </div>
    </div>

    <div class="card">
      <h2>League config</h2>
      <div><span class="badge">Budget: ${cfg.budget}</span> <span class="badge">Team size: ${cfg.teamSize}</span> <span class="badge">${cfg.format}</span></div>
      <p><small>Edit <code>docs/league_config.json</code> in GitHub if you want to rename coaches, budget, etc.</small></p>
    </div>
  `;
}

function renderPoolControls(state) {
  return `
    <div class="card">
      <h2>Pool filters</h2>
      <div class="row">
        <div class="field"><label>Name contains</label><input id="fName" value="${state.name}" placeholder="e.g. gengar" /></div>
        <div class="field"><label>Type contains</label><input id="fType" value="${state.type}" placeholder="e.g. water" /></div>
        <div class="field"><label>Tier</label>
          <select id="fTier">
            <option value="">(any)</option>
            ${['S','A','B','C','D','E','F'].map(t => `<option value="${t}" ${state.tier===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Max points</label><input id="fMaxPts" type="number" min="0" step="1" value="${state.maxPts}" /></div>
        <div class="field" style="justify-content:end"><button class="primary" id="applyFilters">Apply</button></div>
      </div>
      <small>Tip: You can draft in Sheets or use the CLI. This page is for browsing/searching.</small>
    </div>
  `;
}

function renderPoolTable(rows) {
  return `
    <div class="card">
      <h2>Pool (${rows.length})</h2>
      <small>Click a Pokemon to open details (sprite, stats, abilities, moves via PokeAPI).</small>
      <div style="max-height:65vh; overflow:auto; border-radius:12px; margin-top:10px;">
        <table class="table" id="poolTable">
          <thead>
            <tr><th></th><th>Pokemon</th><th>Types</th><th>BST</th><th>Points</th><th>Tier</th></tr>
          </thead>
          <tbody>
            ${rows.map(p => `
              <tr class="clickable" data-dex="${p.dex}" data-name="${p.name}" data-types="${p.types}" data-points="${p.points}" data-tier="${p.tier}">
                <td style="width:40px"><img class="sprite" loading="lazy" src="${spriteUrl(p.dex)}" alt="${p.name}" /></td>
                <td><strong>${prettyName(p.name)}</strong> <small class="badge">#${p.dex}</small></td>
                <td>${renderTypeChips(p.types)}</td>
                <td>${p.bst}</td>
                <td><span class="badge ok">${p.points} pts</span></td>
                <td><span class="badge tier tier-${p.tier}">${p.tier}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSchedule(schedule) {
  const byWeek = {};
  for (const m of schedule) {
    byWeek[m.week] = byWeek[m.week] ?? [];
    byWeek[m.week].push(m);
  }

  const weeks = Object.keys(byWeek).sort((a,b) => Number(a)-Number(b));
  return weeks.map(w => {
    const matches = byWeek[w];
    return `
      <div class="card">
        <h2>Week ${w}</h2>
        <table class="table">
          <thead><tr><th>Match</th><th>Coach 1</th><th>Coach 2</th><th>Format</th></tr></thead>
          <tbody>
            ${matches.map(m => `<tr><td>${m.match}</td><td>${m.coach1}</td><td>${m.coach2}</td><td>${m.format}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

function renderDraft(cfg, pool, state, auth, filterState) {
  if (!state) {
    return `
      <div class="card"><h2>Draft room</h2><small>Loading…</small></div>
    `;
  }

  const poolMap = new Map(pool.map(p => [Number(p.dex), p]));
  const draftedDex = new Set((state.picks || []).map(p => Number(p.pokemon_dex)));

  const name = (filterState.name || '').trim().toLowerCase();
  const type = (filterState.type || '').trim().toLowerCase();
  const tier = (filterState.tier || '').trim().toUpperCase();
  const maxPts = filterState.maxPts === '' ? null : Number(filterState.maxPts);

  let avail = pool.filter(p => !draftedDex.has(Number(p.dex)));
  if (name) avail = avail.filter(p => p.name.toLowerCase().includes(name));
  if (type) avail = avail.filter(p => (p.types || '').toLowerCase().includes(type));
  if (tier) avail = avail.filter(p => (p.tier || '').toUpperCase() === tier);
  if (maxPts !== null && !Number.isNaN(maxPts)) avail = avail.filter(p => Number(p.points) <= maxPts);

  avail.sort((a,b) => Number(b.points)-Number(a.points) || Number(b.bst)-Number(a.bst) || a.name.localeCompare(b.name));

  const turn = state.turn;
  const onClock = turn?.onTheClock;
  const pickNo = (turn?.pickIndex ?? 0) + 1;
  const total = turn?.totalPicks ?? (cfg.coaches.length * cfg.teamSize);

  const budgets = state.budgets || { remaining: {}, spent: {} };
  const remaining = auth.coach ? (budgets.remaining?.[auth.coach] ?? null) : null;

  const locked = Boolean(state.draftState?.locked);
  const canAct = locked && auth.coach && auth.pin && onClock === auth.coach && !turn?.done;

  const rosterCards = cfg.coaches.map(c => {
    const spent = budgets.spent?.[c] ?? 0;
    const rem = budgets.remaining?.[c] ?? cfg.budget;
    const mons = (state.rosters?.[c] || []).map(r => r.pokemon).filter(Boolean);
    return `
      <div class="card roster-card">
        <h2 style="margin:0 0 8px 0">${c} <span class="badge">${spent}/${cfg.budget}</span> <span class="badge ok">${rem} left</span></h2>
        <div class="type-chips">
          ${mons.length ? mons.map(m => `<span class="badge">${prettyName(m.name)} <span class="badge ok">${m.points}</span></span>`).join(' ') : `<small>No picks yet</small>`}
        </div>
      </div>
    `;
  }).join('');

  // Draft board (10 slots)
  const byCoach = {};
  for (const c of cfg.coaches) {
    const rows = (state.rosters?.[c] || []).slice().sort((a,b) => Number(a.pick_no) - Number(b.pick_no));
    byCoach[c] = rows.map(r => r.pokemon).filter(Boolean);
  }

  const boardHeader = `
    <div class="draft-board board-h">
      <div></div>
      ${Array.from({length: cfg.teamSize}, (_,i) => `<div>Pick ${i+1}</div>`).join('')}
    </div>
  `;

  const boardRows = cfg.coaches.map(c => {
    const mons = byCoach[c] || [];
    const cells = Array.from({length: cfg.teamSize}, (_,i) => {
      const mon = mons[i];
      if (!mon) {
        return `<div><div class="pickcell empty" title="Unpicked"><div class="pokeball" aria-hidden="true"></div></div></div>`;
      }
      return `
        <div>
          <div class="pickcell filled" data-action="open" data-dex="${mon.dex}" data-name="${mon.name}" data-types="${mon.types}" data-points="${mon.points}" data-tier="${mon.tier}">
            <img class="sprite" loading="lazy" src="${spriteUrl(mon.dex)}" alt="${mon.name}" />
            <div class="pickmeta">
              <div class="pickname">${prettyName(mon.name)}</div>
              <div><small class="badge ok">${mon.points} pts</small></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="draft-board board-row">
        <div class="board-coach">${c}</div>
        ${cells}
      </div>
    `;
  }).join('');

  const board = `
    <div class="card">
      <h2>Draft board</h2>
      <small>Pokéball = empty slot. Tap a pick to open details.</small>
      <div class="board-wrap" id="boardWrap" style="margin-top:10px">
        ${boardHeader}
        ${boardRows}
      </div>
    </div>
  `;

  // Activity feed / queue
  const upcomingN = 8;
  const next = [];
  if (turn?.order && !turn?.done) {
    for (let i = turn.pickIndex; i < Math.min(turn.pickIndex + upcomingN, turn.order.length); i++) {
      next.push({ pickNo: i+1, coach: turn.order[i] });
    }
  }

  // history uses state.picks directly (mon lookup via poolMap)

  const feed = `
    <div class="card">
      <h2>Pick feed</h2>
      <div class="feed feed-scroll" id="pickFeed">
        <div class="rowline" style="justify-content:space-between">
          <div class="left"><strong>Up next</strong></div>
          <div>${locked ? `<span class="badge ok">Order locked</span>` : `<span class="badge danger">Not started</span>`}</div>
        </div>

        ${next.length ? next.map(n => `
          <div class="rowline">
            <div class="left"><span class="badge">#${n.pickNo}</span> <span class="who">${n.coach}</span></div>
            <div class="what">${n.pickNo === pickNo ? 'on the clock' : ''}</div>
          </div>
        `).join('') : `<div class="rowline"><small>No upcoming picks</small></div>`}

        <div class="rowline" style="justify-content:space-between">
          <div class="left"><strong>History</strong> <span class="badge">${state.picks?.length || 0}</span></div>
          <div class="what">Most recent first</div>
        </div>

        ${(state.picks || []).slice().reverse().map(p => {
          const mon = poolMap.get(Number(p.pokemon_dex));
          const name = mon ? prettyName(mon.name) : `dex ${p.pokemon_dex}`;
          const sprite = mon ? `<img class="sprite" loading="lazy" src="${spriteUrl(p.pokemon_dex)}" alt="${name}" />` : '';
          return `
            <div class="rowline">
              <div class="left">${sprite}<span class="badge">#${p.pick_no}</span> <span class="who">${p.coach}</span></div>
              <div class="what">${name}</div>
            </div>
          `;
        }).join('') || `<div class="rowline"><small>No picks yet.</small></div>`}
      </div>
    </div>
  `;

  const myQueue = auth.coach ? getQueue(auth.coach) : [];
  const qPrefs = auth.coach ? getQueuePrefs(auth.coach) : { autoDraft: false, skipInvalid: false };

  const queueLines = auth.coach ? myQueue.map((dex, idx) => {
    const mon = poolMap.get(Number(dex));
    const drafted = draftedDex.has(Number(dex));
    const cost = mon ? Number(mon.points) : null;
    const over = remaining !== null && cost !== null ? cost > remaining : false;

    const status = drafted ? `<span class="badge danger">taken</span>` : (over ? `<span class="badge danger">budget</span>` : `<span class="badge ok">ok</span>`);
    const label = mon ? prettyName(mon.name) : `dex ${dex}`;
    const sprite = mon ? `<img class="sprite" loading="lazy" src="${spriteUrl(dex)}" alt="${label}" />` : '';

    return `
      <div class="rowline" data-idx="${idx}" data-dex="${dex}">
        <div class="left" style="cursor:${mon ? 'pointer' : 'default'}" ${mon ? `data-action="open" data-dex="${dex}" data-name="${mon.name}" data-types="${mon.types}" data-points="${mon.points}" data-tier="${mon.tier}"` : ''}>
          ${sprite}
          <span class="badge">#${idx+1}</span>
          <span class="who">${label}</span>
          ${mon ? `<span class="badge">${mon.points} pts</span>` : `<span class="badge danger">unknown</span>`}
          ${status}
        </div>
        <div class="queue-actions">
          <button data-qact="up" ${idx===0?'disabled':''}>Up</button>
          <button data-qact="down" ${idx===myQueue.length-1?'disabled':''}>Down</button>
          <button data-qact="rm" class="danger">Remove</button>
        </div>
      </div>
    `;
  }).join('') : '';

  const queueCard = `
    <div class="card">
      <h2>My queue</h2>
      ${auth.coach ? `
        <small>Private to this device. If Auto-draft is ON, it will pick for you when you’re on the clock.</small>
        <div class="row" style="margin-top:10px; align-items:end">
          <div class="field">
            <label><input type="checkbox" id="qAuto" ${qPrefs.autoDraft?'checked':''} /> Auto-draft from queue</label>
          </div>
          <div class="field">
            <small><span class="badge">Stop mode</span> If the top queued mon is taken/over-budget, auto-draft will stop and do nothing.</small>
          </div>
          <div class="field" style="margin-left:auto">
            <button id="qClear" class="danger" ${myQueue.length?'' :'disabled'}>Clear queue</button>
          </div>
        </div>
        <div class="feed" id="queueBox" style="margin-top:10px">
          ${myQueue.length ? queueLines : `<small>No queued Pokemon yet. Use the Queue button in the list below.</small>`}
        </div>
      ` : `<small>Select your coach to use a private queue.</small>`}
    </div>
  `;

  const viewPrefs = getViewPrefs();

  return `
    <div class="card">
      <h2>Draft room</h2>
      <div class="row" style="align-items:end">
        <div class="field">
          <label>Coach</label>
          <select id="dCoach">
            <option value="">(select)</option>
            ${cfg.coaches.map(c => `<option value="${c}" ${auth.coach===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>PIN</label>
          <input id="dPin" inputmode="numeric" placeholder="1234" value="${auth.pin || ''}" />
        </div>
        <div class="field">
          <button id="dSave" class="primary">Save</button>
        </div>
        <div class="field">
          <label>Status</label>
          <div>
            ${turn?.done ? `<span class="badge ok">Draft complete</span>` : `<span class="badge">Pick ${pickNo}/${total}</span> <span class="badge ok">On the clock: ${onClock || '?'}</span>`}
          </div>
          ${remaining !== null ? `<small>${auth.coach} remaining budget: ${remaining}</small>` : `<small>Select your coach to see budget + draft.</small>`}
        </div>
        <div class="field">
          <label>View</label>
          <div class="type-chips" style="align-items:center">
            <label class="badge" style="display:flex;gap:6px;align-items:center"><input id="vFeed" type="checkbox" ${viewPrefs.showFeed?'checked':''}/> Show pick feed (left)</label>
          </div>
          <small>Turn this off to scroll straight to the Pokemon list.</small>
        </div>
      </div>
      <small>${locked ? 'Draft is live.' : 'Admin needs to shuffle (optional) and START to lock the order.'}</small>

      <div style="margin-top:10px">
        <div class="row" style="align-items:end">
          <div class="field" style="flex:1">
            <label>Draft order</label>
            <div class="type-chips" id="orderChips">
              ${(turn?.baseOrder || cfg.coaches).map(c => `<span class="badge">${c}</span>`).join(' ')}
              ${locked ? `<span class="badge ok">locked</span>` : `<span class="badge danger">unlocked</span>`}
            </div>
          </div>
          <div class="field">
            <label>Admin</label>
            <div class="row" style="gap:8px">
              <button id="shuffleBtn" ${locked || (state.picks?.length>0) ? 'disabled' : ''}>Reshuffle</button>
              <button id="lockBtn" class="primary" ${locked ? 'disabled' : ''}>Start (lock)</button>
            </div>
            <small>Uses your PIN (Billy=admin).</small>
          </div>
        </div>
      </div>
    </div>

    <div class="draft-layout">
      ${viewPrefs.showFeed ? `<div class="draft-sidebar">${feed}</div>` : ''}

      <div class="draft-main">
        <div class="roster-grid">
          ${rosterCards}
        </div>

        ${renderPoolControls(filterState)}

        <div class="card">
          <h2>Available Pokemon <span class="badge">${avail.length}</span></h2>
          <small>Click a row for details. Use the Draft button to lock in your pick when it’s your turn.</small>
          <div style="max-height:65vh; overflow:auto; border-radius:12px; margin-top:10px;">
            <table class="table" id="draftTable">
              <thead>
                <tr><th></th><th>Pokemon</th><th>Types</th><th>Pts</th><th>Tier</th><th></th></tr>
              </thead>
              <tbody>
                ${avail.map(p => {
                  const cost = Number(p.points);
                  const over = remaining !== null ? (cost > remaining) : false;
                  const disabled = !canAct || over;
                  const btnText = over ? 'Budget' : (!canAct ? 'Wait' : 'Draft');
                  return `
                    <tr class="clickable" data-dex="${p.dex}" data-name="${p.name}" data-types="${p.types}" data-points="${p.points}" data-tier="${p.tier}">
                      <td style="width:40px"><img class="sprite" loading="lazy" src="${spriteUrl(p.dex)}" alt="${p.name}" /></td>
                      <td><strong>${prettyName(p.name)}</strong> <small class="badge">#${p.dex}</small></td>
                      <td>${renderTypeChips(p.types)}</td>
                      <td><span class="badge ok">${p.points} pts</span></td>
                      <td><span class="badge tier tier-${p.tier}">${p.tier}</span></td>
                      <td style="text-align:right">
                        <div class="row" style="gap:8px; justify-content:flex-end">
                          <button data-action="queue" data-dex="${p.dex}">Queue</button>
                          <button class="primary" data-action="pick" data-dex="${p.dex}" ${disabled ? 'disabled' : ''}>${btnText}</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${queueCard}
      </div>
    </div>
  `;
}

function renderResults(cfg, schedule, results, standings) {
  const rows = schedule.map(m => {
    const key = defaultMatchKey(m);
    const r = results[key] ?? { aWins: 0, bWins: 0 };
    return { ...m, key, aWins: r.aWins ?? 0, bWins: r.bWins ?? 0 };
  });

  const standingsHtml = `
    <div class="card">
      <h2>Standings (Weeks 1–3)</h2>
      <table class="table">
        <thead><tr><th>Seed</th><th>Coach</th><th>Points</th><th>W-L</th><th>Diff</th></tr></thead>
        <tbody>
          ${standings.map(s => `<tr><td>${s.seed}</td><td><strong>${s.coach}</strong></td><td>${s.points}</td><td>${s.wins}-${s.losses}</td><td>${s.diff}</td></tr>`).join('')}
        </tbody>
      </table>
      <small>Tiebreakers: total points → head-to-head among tied → diff → tiebreak game.</small>
    </div>
  `;

  const entryHtml = `
    <div class="card">
      <h2>Enter results</h2>
      <small>Bo2 each match (two games). Put how many games each coach won (0–2). This page auto-saves.</small>
      <div style="margin-top:10px; overflow:auto; border-radius:12px;">
        <table class="table">
          <thead><tr><th>Week</th><th>Match</th><th>Coach A</th><th>A wins</th><th>Coach B</th><th>B wins</th></tr></thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td>${m.week}</td>
                <td>${m.match}</td>
                <td>${m.coach1}</td>
                <td><input data-key="${m.key}" data-side="a" type="number" min="0" max="2" step="1" value="${m.aWins}" style="width:70px" /></td>
                <td>${m.coach2}</td>
                <td><input data-key="${m.key}" data-side="b" type="number" min="0" max="2" step="1" value="${m.bWins}" style="width:70px" /></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="row" style="margin-top:10px; align-items:end;">
        <div class="field"><label>Export results</label><button id="exportBtn" class="primary">Download JSON</button></div>
        <div class="field"><label>Import results</label><input id="importFile" type="file" accept="application/json" /></div>
        <div class="field"><label>Reset</label><button id="resetBtn" class="danger">Clear local results</button></div>
      </div>
    </div>
  `;

  const playoffsHtml = `
    <div class="card">
      <h2>Week 4 playoffs (template)</h2>
      <small>#1 seed picks semifinal opponent (seed 3 or 4). Series: ${cfg.playoffs.series}.</small>
      <div style="margin-top:10px" id="playoffBlock"></div>
    </div>
  `;

  return standingsHtml + entryHtml + playoffsHtml;
}

function renderRules() {
  return `
    <div class="card">
      <h2>Rules</h2>
      <p><a href="./LEAGUE_RULES.md" target="_blank" rel="noopener">Open full rules (markdown)</a></p>
      <p><small>If you want this rendered nicely, we can add a markdown renderer later — keeping v1 simple.</small></p>
    </div>
  `;
}

function renderPlayoffs(standings) {
  const s1 = standings[0]?.coach ?? 'Seed1';
  const s2 = standings[1]?.coach ?? 'Seed2';
  const s3 = standings[2]?.coach ?? 'Seed3';
  const s4 = standings[3]?.coach ?? 'Seed4';

  const pick = (localStorage.getItem('pcdl_v1_playoff_pick') ?? '4');

  const semi1 = pick === '3' ? [s1, s3] : [s1, s4];
  const semi2 = pick === '3' ? [s2, s4] : [s2, s3];

  $('#playoffBlock').innerHTML = `
    <div class="row">
      <div class="field">
        <label>#1 seed pick</label>
        <select id="pickSel">
          <option value="3" ${pick==='3'?'selected':''}>Play seed 3</option>
          <option value="4" ${pick==='4'?'selected':''}>Play seed 4</option>
        </select>
      </div>
      <div class="field"><label>Semifinal 1</label><div><span class="badge ok">${semi1[0]}</span> vs <span class="badge">${semi1[1]}</span></div></div>
      <div class="field"><label>Semifinal 2</label><div><span class="badge ok">${semi2[0]}</span> vs <span class="badge">${semi2[1]}</span></div></div>
    </div>
  `;

  $('#pickSel').addEventListener('change', (e) => {
    localStorage.setItem('pcdl_v1_playoff_pick', e.target.value);
    renderPlayoffs(standings);
  });
}

async function main() {
  const cfg = await loadJson('./league_config.json');
  document.title = cfg.leagueName;
  $('#leagueTitle').textContent = cfg.leagueName;
  $('#leagueSub').textContent = `${cfg.coaches.length} coaches · ${cfg.teamSize} mons · Gen1–3 · no legends/mythicals · ${cfg.format} · no Tera/Dmax · budget ${cfg.budget}`;

  const poolCsv = await loadText('./data/pool.csv');
  const scheduleCsv = await loadText('./data/schedule.csv');

  const pool = parseCsv(poolCsv);
  const schedule = parseCsv(scheduleCsv);

  // normalize schedule numeric fields
  schedule.forEach(m => {
    m.week = Number(m.week);
    m.match = Number(m.match);
  });

  let poolFilterState = { name: '', type: '', tier: '', maxPts: '' };
  let draftFilterState = { name: '', type: '', tier: '', maxPts: '' };

  // Detect whether we’re running behind the Fly backend (shared storage)
  let apiOk = false;
  try {
    const health = await apiGet('/api/health');
    apiOk = Boolean(health?.ok && health?.storage);
  } catch {
    apiOk = false;
  }

  let sharedState = null;
  let pollHandle = null;
  let draftSig = '';
  let autoDraftInFlight = false;
  let lastAutoPickKey = '';

  function clearPoll() {
    if (pollHandle) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  }

  async function refreshSharedState() {
    if (!apiOk) return null;
    sharedState = await apiGet('/api/state');
    return sharedState;
  }

  async function maybeAutoDraft(state) {
    if (!apiOk) return;
    if (!state) return;

    const auth = getAuth();
    if (!auth.coach || !auth.pin) return;

    const prefs = getQueuePrefs(auth.coach);
    if (!prefs.autoDraft) return;

    const locked = Boolean(state.draftState?.locked);
    if (!locked) return;

    const turn = state.turn;
    if (!turn || turn.done) return;
    if (turn.onTheClock !== auth.coach) return;

    const key = `${turn.pickIndex}|${state.picks?.length || 0}`;
    if (autoDraftInFlight || lastAutoPickKey === key) return;

    const poolByDex = new Map(pool.map(p => [Number(p.dex), p]));
    const draftedDex = new Set((state.picks || []).map(p => Number(p.pokemon_dex)));
    const remaining = state.budgets?.remaining?.[auth.coach];

    const queue = getQueue(auth.coach);
    const sel = nextPickFromQueue(queue, {
      draftedDex,
      poolByDex,
      remainingBudget: remaining,
      skipInvalid: prefs.skipInvalid,
    });

    // If we pruned dead entries, persist it.
    if (prefs.skipInvalid && sel.removed?.length && sel.action !== 'pick') {
      setQueue(auth.coach, sel.queueAfter);
    }

    if (sel.action !== 'pick' || !sel.pickDex) return;

    lastAutoPickKey = key;
    autoDraftInFlight = true;
    try {
      await apiPost('/api/pick', { coach: auth.coach, pin: auth.pin, pokemonDex: sel.pickDex });
      setQueue(auth.coach, sel.queueAfter);
      await refreshSharedState();
      route();
    } catch (err) {
      const msg = String(err?.message || err);
      // If it's a "real" failure (bad pin / not your turn / not started), don't mutate the queue.
      const transient = msg.includes('not your turn') || msg.includes('not started') || msg.includes('bad pin') || msg.includes('coach and pin required');
      if (!transient && prefs.skipInvalid) {
        // Assume the pick became invalid (taken, budget changed, etc.) and move on.
        setQueue(auth.coach, sel.queueAfter);
      }
      // Let the user see the error if they're watching.
      // (Avoid spamming alerts; this only happens when auto-draft is enabled.)
      console.warn('auto-draft failed:', msg);
      await refreshSharedState();
      route();
    } finally {
      autoDraftInFlight = false;
    }
  }

  function setActive(route) {
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  }

  function route() {
    clearPoll();
    const hash = (location.hash || '#home').slice(1);
    const app = $('#app');

    const results = getResults();
    const standings = computeStandings(cfg.coaches, schedule, results);

    if (hash === 'home') {
      setActive('home');
      app.innerHTML = renderHome(cfg);
      return;
    }

    if (hash === 'pool') {
      setActive('pool');

      // filter
      let rows = pool;
      const name = poolFilterState.name.trim().toLowerCase();
      const type = poolFilterState.type.trim().toLowerCase();
      const tier = poolFilterState.tier.trim().toUpperCase();
      const maxPts = poolFilterState.maxPts === '' ? null : Number(poolFilterState.maxPts);

      if (name) rows = rows.filter(p => p.name.toLowerCase().includes(name));
      if (type) rows = rows.filter(p => p.types.toLowerCase().includes(type));
      if (tier) rows = rows.filter(p => (p.tier || '').toUpperCase() === tier);
      if (maxPts !== null && !Number.isNaN(maxPts)) rows = rows.filter(p => Number(p.points) <= maxPts);

      // sort best-first
      rows = [...rows].sort((a,b) => Number(b.points)-Number(a.points) || Number(b.bst)-Number(a.bst) || a.name.localeCompare(b.name));

      app.innerHTML = renderPoolControls(poolFilterState) + renderPoolTable(rows);
      $('#applyFilters').addEventListener('click', () => {
        poolFilterState = {
          name: $('#fName').value,
          type: $('#fType').value,
          tier: $('#fTier').value,
          maxPts: $('#fMaxPts').value,
        };
        route();
      });

      // Row click → details dialog
      const tbody = $('#poolTable tbody');
      tbody?.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-dex]');
        if (!tr) return;
        openPokemonDialog({
          dex: Number(tr.dataset.dex),
          name: tr.dataset.name,
          types: tr.dataset.types,
          points: Number(tr.dataset.points),
          tier: tr.dataset.tier,
        });
      });

      return;
    }

    if (hash === 'draft') {
      setActive('draft');

      if (!apiOk) {
        app.innerHTML = `
          <div class="card">
            <h2>Draft room</h2>
            <p><span class="badge danger">Not available here</span></p>
            <small>This page needs the Fly backend (persistent storage). The GitHub Pages site is read-only.</small>
          </div>
        `;
        return;
      }

      const auth = getAuth();
      app.innerHTML = renderDraft(cfg, pool, null, auth, draftFilterState);

      refreshSharedState().then((state) => {
        const auth2 = getAuth();
        $('#app').innerHTML = renderDraft(cfg, pool, state, auth2, draftFilterState);

        // Save auth
        $('#dSave')?.addEventListener('click', () => {
          setAuth({ coach: $('#dCoach').value, pin: $('#dPin').value });
          route();
        });

        // Admin controls
        $('#shuffleBtn')?.addEventListener('click', () => {
          const pin = getAuth().pin;
          apiPost('/api/admin/shuffle', { adminPin: pin })
            .then(() => refreshSharedState())
            .then(() => route())
            .catch(err => alert(err.message));
        });

        $('#lockBtn')?.addEventListener('click', () => {
          const pin = getAuth().pin;
          apiPost('/api/admin/lock', { adminPin: pin })
            .then(() => refreshSharedState())
            .then(() => route())
            .catch(err => alert(err.message));
        });

        // Filters
        $('#applyFilters')?.addEventListener('click', () => {
          draftFilterState = {
            name: $('#fName').value,
            type: $('#fType').value,
            tier: $('#fTier').value,
            maxPts: $('#fMaxPts').value,
          };
          route();
        });

        // Draft table click: pick or open details
        const tbody = $('#draftTable tbody');
        tbody?.addEventListener('click', (e) => {
          const qbtn = e.target.closest('button[data-action="queue"]');
          if (qbtn) {
            const dex = Number(qbtn.dataset.dex);
            const a = getAuth();
            if (!a.coach) {
              alert('Select your coach first to use a private queue.');
              return;
            }
            const q = getQueue(a.coach);
            q.push(dex);
            setQueue(a.coach, q);
            route();
            e.stopPropagation();
            return;
          }

          const btn = e.target.closest('button[data-action="pick"]');
          if (btn) {
            const dex = Number(btn.dataset.dex);
            const auth3 = getAuth();
            apiPost('/api/pick', { coach: auth3.coach, pin: auth3.pin, pokemonDex: dex })
              .then(() => refreshSharedState())
              .then(() => route())
              .catch(err => alert(err.message));
            e.stopPropagation();
            return;
          }

          const tr = e.target.closest('tr[data-dex]');
          if (!tr) return;
          openPokemonDialog({
            dex: Number(tr.dataset.dex),
            name: tr.dataset.name,
            types: tr.dataset.types,
            points: Number(tr.dataset.points),
            tier: tr.dataset.tier,
          });
        });

        // Board click: open details
        // (boardWrap might not exist if hidden)
        $('#boardWrap')?.addEventListener('click', (e) => {
          const cell = e.target.closest('[data-action="open"]');
          if (!cell) return;
          openPokemonDialog({
            dex: Number(cell.dataset.dex),
            name: cell.dataset.name,
            types: cell.dataset.types,
            points: Number(cell.dataset.points),
            tier: cell.dataset.tier,
          });
        });

        // View toggles
        $('#vFeed')?.addEventListener('change', (e) => {
          const vp = getViewPrefs();
          vp.showFeed = Boolean(e.target.checked);
          setViewPrefs(vp);
          route();
        });

        // draft board hidden for now

        // Queue controls
        const aNow = getAuth();
        $('#qAuto')?.addEventListener('change', (e) => {
          if (!aNow.coach) return;
          const prefs = getQueuePrefs(aNow.coach);
          prefs.autoDraft = Boolean(e.target.checked);
          setQueuePrefs(aNow.coach, prefs);
          route();
        });

        // skipInvalid toggle removed (always stop)

        $('#qClear')?.addEventListener('click', () => {
          const a = getAuth();
          if (!a.coach) return;
          if (!confirm('Clear your private queue on this device?')) return;
          setQueue(a.coach, []);
          route();
        });

        $('#queueBox')?.addEventListener('click', (e) => {
          const open = e.target.closest('[data-action="open"]');
          if (open) {
            openPokemonDialog({
              dex: Number(open.dataset.dex),
              name: open.dataset.name,
              types: open.dataset.types,
              points: Number(open.dataset.points),
              tier: open.dataset.tier,
            });
            return;
          }

          const btn = e.target.closest('button[data-qact]');
          if (!btn) return;
          const row = e.target.closest('.rowline');
          if (!row) return;
          const idx = Number(row.dataset.idx);
          const a = getAuth();
          if (!a.coach) return;
          const q = getQueue(a.coach);

          const act = btn.dataset.qact;
          if (act === 'rm') {
            q.splice(idx, 1);
          } else if (act === 'up' && idx > 0) {
            const tmp = q[idx-1];
            q[idx-1] = q[idx];
            q[idx] = tmp;
          } else if (act === 'down' && idx < q.length-1) {
            const tmp = q[idx+1];
            q[idx+1] = q[idx];
            q[idx] = tmp;
          }

          setQueue(a.coach, q);
          route();
        });

        // Attempt auto-draft once on render
        maybeAutoDraft(state);

        // Poll for changes (other coaches picking)
        draftSig = `${state.picks?.length || 0}|${state.draftState?.locked ? 1 : 0}|${state.turn?.pickIndex || 0}`;
        pollHandle = setInterval(async () => {
          try {
            if ((location.hash || '#home').slice(1) !== 'draft') return;
            const s = await refreshSharedState();
            const sig = `${s.picks?.length || 0}|${s.draftState?.locked ? 1 : 0}|${s.turn?.pickIndex || 0}`;
            if (sig !== draftSig) {
              draftSig = sig;
              route();
            }
          } catch {
            // ignore
          }
        }, 2000);
      }).catch(err => {
        $('#app').innerHTML = `<div class="card"><h2>Draft room</h2><p><span class="badge danger">Error</span> <small>${err.message}</small></p></div>`;
      });

      return;
    }

    if (hash === 'schedule') {
      setActive('schedule');
      app.innerHTML = renderSchedule(schedule);
      return;
    }

    if (hash === 'results') {
      setActive('results');
      app.innerHTML = renderResults(cfg, schedule, results, standings);

      // wire inputs
      $$('input[data-key]').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const key = e.target.dataset.key;
          const side = e.target.dataset.side;
          const val = Number(e.target.value);
          const obj = getResults();
          obj[key] = obj[key] ?? { aWins: 0, bWins: 0 };
          if (side === 'a') obj[key].aWins = val;
          if (side === 'b') obj[key].bWins = val;
          setResults(obj);

          // rerender standings + playoffs block quickly
          const newStandings = computeStandings(cfg.coaches, schedule, getResults());
          // update table body
          const tbody = $('.card table.table tbody');
          // First table is standings (safe: just reroute for simplicity)
          route();
        });
      });

      $('#exportBtn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(getResults(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pcdl_results.json';
        a.click();
        URL.revokeObjectURL(url);
      });

      $('#importFile').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const obj = JSON.parse(text);
          setResults(obj);
          route();
        } catch {
          alert('Invalid JSON');
        }
      });

      $('#resetBtn').addEventListener('click', () => {
        if (!confirm('Clear saved local results?')) return;
        localStorage.removeItem(STORAGE_KEY);
        route();
      });

      renderPlayoffs(standings);
      return;
    }

    if (hash === 'rules') {
      setActive('rules');
      app.innerHTML = renderRules();
      return;
    }

    // fallback
    location.hash = '#home';
  }

  window.addEventListener('hashchange', route);
  route();
}

main().catch(err => {
  $('#app').innerHTML = `<div class="card"><h2>Error</h2><pre>${err.message}</pre></div>`;
  console.error(err);
});
