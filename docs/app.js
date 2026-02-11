const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = 'pcdl_v1_results';

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
      <div style="max-height:65vh; overflow:auto; border-radius:12px;">
        <table class="table">
          <thead>
            <tr><th>Name</th><th>Types</th><th>BST</th><th>Points</th><th>Tier</th><th>Dex</th></tr>
          </thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.types}</td>
                <td>${p.bst}</td>
                <td>${p.points}</td>
                <td><span class="badge">${p.tier}</span></td>
                <td>${p.dex}</td>
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

  function setActive(route) {
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  }

  function route() {
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
