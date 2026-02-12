import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL;

const COACH_PINS_JSON = process.env.COACH_PINS_JSON || ''; // e.g. {"Billy":"1234",...}
const ADMIN_PIN = process.env.ADMIN_PIN || '';

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

function readText(p) {
  return fs.readFileSync(p, 'utf-8');
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

function snakeOrder(coaches, rounds) {
  const order = [];
  for (let r = 0; r < rounds; r++) {
    if (r % 2 === 0) order.push(...coaches);
    else order.push(...[...coaches].reverse());
  }
  return order;
}

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const docsDir = path.join(root, 'docs');
const dataDir = path.join(docsDir, 'data');
const cfgPath = path.join(docsDir, 'league_config.json');
const poolPath = path.join(dataDir, 'pool.csv');
const schedulePath = path.join(dataDir, 'schedule.csv');
const schemaPath = path.join(root, 'server', 'schema.sql');

const cfg = safeJsonParse(readText(cfgPath), null);
must(cfg, 'Failed to load league_config.json');

const poolRows = parseCsv(readText(poolPath));
const scheduleRows = parseCsv(readText(schedulePath)).map(m => ({
  ...m,
  week: Number(m.week),
  match: Number(m.match),
}));

const poolByDex = new Map();
for (const p of poolRows) {
  const dex = Number(p.dex);
  poolByDex.set(dex, {
    dex,
    name: p.name,
    types: p.types,
    bst: Number(p.bst),
    points: Number(p.points),
    tier: p.tier,
  });
}

const coachPins = safeJsonParse(COACH_PINS_JSON, {});

function requireCoachAuth(coach, pin) {
  must(coach && pin, 'coach and pin required');
  must(cfg.coaches.includes(coach), 'unknown coach');
  must(String(coachPins[coach] || '') === String(pin), 'bad pin');
}

function requireAdmin(pin) {
  must(ADMIN_PIN && String(pin) === String(ADMIN_PIN), 'admin pin required/invalid');
}

let pool;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function migrate() {
  if (!pool) return;
  const sql = readText(schemaPath);
  await pool.query(sql);
}

async function getPicks() {
  if (!pool) return [];
  const r = await pool.query('SELECT pick_no, coach, pokemon_dex, points, created_at FROM draft_picks ORDER BY pick_no ASC');
  return r.rows;
}

async function getResults() {
  if (!pool) return {};
  const r = await pool.query('SELECT match_key, a_wins, b_wins FROM match_results');
  const out = {};
  for (const row of r.rows) out[row.match_key] = { aWins: row.a_wins, bWins: row.b_wins };
  return out;
}

function computeBudgets(picks) {
  const spent = {};
  for (const c of cfg.coaches) spent[c] = 0;
  for (const p of picks) spent[p.coach] = (spent[p.coach] || 0) + Number(p.points);
  const remaining = {};
  for (const c of cfg.coaches) remaining[c] = cfg.budget - (spent[c] || 0);
  return { spent, remaining };
}

function currentTurn(picksCount) {
  const order = snakeOrder(cfg.coaches, cfg.teamSize);
  const idx = Math.min(picksCount, order.length - 1);
  return { order, pickIndex: picksCount, onTheClock: order[picksCount] ?? null, totalPicks: order.length, done: picksCount >= order.length };
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// serve frontend
app.use(express.static(docsDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: Boolean(DATABASE_URL) });
});

app.get('/api/config', (req, res) => {
  res.json({ ...cfg, coaches: cfg.coaches, budget: cfg.budget, teamSize: cfg.teamSize });
});

app.get('/api/state', asyncHandler(async (req, res) => {
  const picks = await getPicks();
  const results = await getResults();
  const budgets = computeBudgets(picks);
  const turn = currentTurn(picks.length);

  // roster view
  const rosters = {};
  for (const c of cfg.coaches) rosters[c] = [];
  for (const pick of picks) {
    const mon = poolByDex.get(Number(pick.pokemon_dex));
    rosters[pick.coach].push({ ...pick, pokemon: mon });
  }

  res.json({ picks, results, budgets, turn, rosters });
}));

app.post('/api/pick', asyncHandler(async (req, res) => {
  must(pool, 'storage not configured (DATABASE_URL missing)');

  const { coach, pin, pokemonDex } = req.body || {};
  requireCoachAuth(coach, pin);

  const dex = Number(pokemonDex);
  must(Number.isFinite(dex), 'pokemonDex required');
  const mon = poolByDex.get(dex);
  must(mon, 'pokemon not in pool');

  const picks = await getPicks();
  const turn = currentTurn(picks.length);
  must(!turn.done, 'draft complete');
  must(turn.onTheClock === coach, `not your turn (on the clock: ${turn.onTheClock})`);

  // budget check
  const budgets = computeBudgets(picks);
  must(budgets.remaining[coach] >= mon.points, `over budget (remaining ${budgets.remaining[coach]}, cost ${mon.points})`);

  // insert
  const pickNo = picks.length + 1;
  await pool.query(
    'INSERT INTO draft_picks (pick_no, coach, pokemon_dex, points) VALUES ($1,$2,$3,$4)',
    [pickNo, coach, dex, mon.points]
  );

  res.json({ ok: true, pickNo, coach, pokemon: mon });
}));

app.post('/api/undo_last', asyncHandler(async (req, res) => {
  must(pool, 'storage not configured (DATABASE_URL missing)');
  const { adminPin } = req.body || {};
  requireAdmin(adminPin);

  const r = await pool.query('SELECT id, pick_no FROM draft_picks ORDER BY pick_no DESC LIMIT 1');
  if (r.rowCount === 0) return res.json({ ok: true, removed: null });
  const id = r.rows[0].id;
  await pool.query('DELETE FROM draft_picks WHERE id=$1', [id]);
  res.json({ ok: true, removed: r.rows[0] });
}));

app.post('/api/reset_draft', asyncHandler(async (req, res) => {
  must(pool, 'storage not configured (DATABASE_URL missing)');
  const { adminPin } = req.body || {};
  requireAdmin(adminPin);
  await pool.query('DELETE FROM draft_picks');
  res.json({ ok: true });
}));

app.post('/api/result', asyncHandler(async (req, res) => {
  must(pool, 'storage not configured (DATABASE_URL missing)');
  const { matchKey, aWins, bWins, adminPin } = req.body || {};
  // allow admin-only for now (simplest)
  requireAdmin(adminPin);
  must(matchKey, 'matchKey required');
  const aw = Number(aWins);
  const bw = Number(bWins);
  must([0,1,2].includes(aw) && [0,1,2].includes(bw), 'wins must be 0-2');

  await pool.query(
    'INSERT INTO match_results (match_key, a_wins, b_wins) VALUES ($1,$2,$3) ON CONFLICT (match_key) DO UPDATE SET a_wins=$2, b_wins=$3, updated_at=now()',
    [matchKey, aw, bw]
  );

  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error(err);
  const msg = err?.message || 'error';
  res.status(400).json({ ok: false, message: msg });
});

// SPA fallback (hash routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(docsDir, 'index.html'));
});

(async () => {
  try {
    await migrate();
    app.listen(PORT, () => {
      console.log(`server listening on :${PORT}`);
      console.log(`storage: ${DATABASE_URL ? 'postgres' : 'NONE'}`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
