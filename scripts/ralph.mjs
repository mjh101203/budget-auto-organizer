#!/usr/bin/env node
/**
 * ralph.mjs — Claude Code용 랄프 루프 runner (Windows / macOS / Linux 공통, 의존성 없음)
 *
 *   node scripts/ralph.mjs plan                  계획 1회 (IMPLEMENTATION_PLAN.md 생성/갱신)
 *   node scripts/ralph.mjs build --until 16:30   빌드 루프 (지정 시각까지)
 *   node scripts/ralph.mjs say 지시 내용          돌고 있는 루프에 지시 끼워넣기
 *   node scripts/ralph.mjs status | pause | resume | stop
 *   node scripts/ralph.mjs help                  전체 옵션
 *
 * 설계 원칙
 *   - 매 iteration = 새 claude -p 프로세스 = 새 컨텍스트. 기억은 파일(specs/, IMPLEMENTATION_PLAN.md, PROGRESS.md)에만.
 *   - 프롬프트는 stdin(UTF-8)으로 넘긴다 → Windows PowerShell 인코딩/따옴표 문제 회피.
 *   - 완료 선언(RALPH_DONE)은 runner가 직접 검증(계획 체크 + npm run check). 거짓 완료 차단.
 *   - 사용량 제한에 걸리면 iteration을 버리지 않고 기다렸다가 재시도.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, '.ralph');
const LOGS = path.join(STATE, 'logs');
const STEER = path.join(STATE, 'steer');
const STEER_DONE = path.join(STEER, 'done');
const FILES = {
  pause: path.join(STATE, 'PAUSE'),
  stop: path.join(STATE, 'STOP'),
  counter: path.join(STATE, 'iteration'),
  runs: path.join(STATE, 'runs.jsonl'),
  plan: path.join(ROOT, 'IMPLEMENTATION_PLAN.md'),
  progress: path.join(ROOT, 'PROGRESS.md'),
};
const SETTINGS = path.join(ROOT, 'scripts', 'claude-settings.json'); // 훅 + 권한. --settings로 매번 주입
const PROMPTS = { plan: 'PROMPT_plan.md', build: 'PROMPT_build.md', qa: 'PROMPT_qa.md' };
const DONE_TOKEN = 'RALPH_DONE';
const IS_WIN = process.platform === 'win32';

// ───────────────────────── 출력 유틸 ─────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const dim = paint('2'), bold = paint('1'), red = paint('31'), green = paint('32');
const yellow = paint('33'), cyan = paint('36'), magenta = paint('35');
const pad2 = (n) => String(n).padStart(2, '0');
const clock = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const clockS = (d = new Date()) => `${clock(d)}:${pad2(d.getSeconds())}`;
const log = (msg = '') => console.log(`${dim(clockS())} ${msg}`);
const oneLine = (s, n = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h${pad2(m)}m` : m ? `${m}m${pad2(r)}s` : `${r}s`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bell = () => { if (process.stdout.isTTY) process.stdout.write('\x07'); };

// ───────────────────────── 인자 ─────────────────────────
function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  const opts = { _: [], extra: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--') { opts.extra = rest.slice(i + 1); break; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) opts[key] = true;
      else { opts[key] = next; i++; }
    } else opts._.push(a);
  }
  return { cmd, opts };
}

// ───────────────────────── 상태 파일 ─────────────────────────
function ensureDirs() {
  for (const d of [STATE, LOGS, STEER, STEER_DONE]) fs.mkdirSync(d, { recursive: true });
}
function nextIter() {
  let n = 0;
  try { n = Number(fs.readFileSync(FILES.counter, 'utf8')) || 0; } catch {}
  fs.writeFileSync(FILES.counter, String(n + 1));
  return n + 1;
}
function appendRun(obj) {
  try { fs.appendFileSync(FILES.runs, `${JSON.stringify(obj)}\n`); } catch {}
}

// 사람/QA/runner → 빌더로 가는 지시 큐. 파일 1개 = 지시 1개 (동시 편집 충돌 없음)
function addSteer(text, from = 'human') {
  ensureDirs();
  const file = `${Date.now()}-${from}.md`;
  fs.writeFileSync(path.join(STEER, file), `${text.trim()}\n`, 'utf8');
  return file;
}
function pendingSteer() {
  if (!fs.existsSync(STEER)) return [];
  return fs.readdirSync(STEER)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const [ts, from = 'human'] = f.replace(/\.md$/, '').split('-');
      const text = fs.readFileSync(path.join(STEER, f), 'utf8').trim();
      return { file: f, time: clock(new Date(Number(ts))), from, text };
    });
}
function consumeSteer(items) {
  for (const s of items) {
    try { fs.renameSync(path.join(STEER, s.file), path.join(STEER_DONE, s.file)); } catch {}
  }
}

function planStats() {
  let txt = '';
  try { txt = fs.readFileSync(FILES.plan, 'utf8'); } catch { return { open: 0, done: 0, total: 0, p0open: 0 }; }
  const open = (txt.match(/^\s*[-*]\s+\[ \]/gm) || []).length;
  const done = (txt.match(/^\s*[-*]\s+\[[xX]\]/gm) || []).length;
  const p0 = txt.split(/^##\s+/m).find((sec) => /^P0/.test(sec)) || '';
  const p0open = (p0.match(/^\s*[-*]\s+\[ \]/gm) || []).length;
  return { open, done, total: open + done, p0open };
}

// ───────────────────────── git ─────────────────────────
function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function ensureGit() {
  if (spawnSync('git', ['--version']).status !== 0) {
    log(red('git이 없음 → https://git-scm.com 에서 설치'));
    process.exit(1);
  }
  if (!fs.existsSync(path.join(ROOT, '.git'))) { git(['init', '-q']); log(dim('git init')); }
  if (!git(['config', 'user.name']).out) git(['config', 'user.name', 'ralph']);
  if (!git(['config', 'user.email']).out) git(['config', 'user.email', 'ralph@localhost']);
  if (!git(['rev-parse', '--verify', '-q', 'HEAD']).ok) {
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'chore: ralph harness init', '--no-verify']);
  }
}
const headSha = () => git(['rev-parse', 'HEAD']).out;
const isDirty = () => git(['status', '--porcelain']).out.length > 0;
const commitsSince = (sha) => (sha ? Number(git(['rev-list', '--count', `${sha}..HEAD`]).out || 0) : 0);

// ───────────────────────── 검증 ─────────────────────────
function hasCheckScript() {
  try { return !!JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts?.check; } catch { return false; }
}
function runCheck() {
  const r = spawnSync(IS_WIN ? 'npm run check' : 'npm', IS_WIN ? [] : ['run', 'check'], {
    cwd: ROOT, encoding: 'utf8', shell: IS_WIN, timeout: 10 * 60_000,
    env: { ...process.env, RALPH_MODE: 'verify', CI: '1' },
  });
  const tail = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').slice(-60).join('\n');
  return { ok: r.status === 0, tail };
}
function claimsDone(r) {
  const text = String(r.result?.result ?? '');
  const last = text.trim().split('\n').map((l) => l.trim()).filter(Boolean).pop() || '';
  return last.replace(/[`*\s]/g, '') === DONE_TOKEN;
}
function verifyDone() {
  const ps = planStats();
  if (ps.total === 0) return { ok: false, reason: 'IMPLEMENTATION_PLAN.md에 체크리스트 항목이 없음' };
  if (ps.open > 0) return { ok: false, reason: `IMPLEMENTATION_PLAN.md에 미완료 항목 ${ps.open}개가 남아 있음` };
  if (!hasCheckScript()) return { ok: false, reason: 'package.json에 check 스크립트가 없음' };
  log(dim('npm run check로 완료 선언 검증 중…'));
  const c = runCheck();
  if (!c.ok) return { ok: false, reason: '`npm run check` 실패', tail: c.tail };
  return { ok: true };
}

// ───────────────────────── 프롬프트 ─────────────────────────
function buildPrompt(mode, iter, untilTs) {
  const file = path.join(ROOT, PROMPTS[mode]);
  if (!fs.existsSync(file)) throw new Error(`${PROMPTS[mode]} 파일이 없음`);
  const base = fs.readFileSync(file, 'utf8');
  const steer = mode === 'qa' ? [] : pendingSteer(); // QA는 빌더 몫의 지시를 가져가지 않음
  let head = '';
  if (steer.length) {
    head += '# ⚠ 실시간 지시 — 이번 iteration 최우선\n\n';
    head += '루프가 도는 중에 들어온 지시다. 이번 iteration에서는 계획보다 이것을 먼저 처리하라. '
      + '계획/스펙 변경이면 IMPLEMENTATION_PLAN.md에 반영하라. 한 iteration에 다 못 하면 남은 것은 계획의 P0 맨 위에 넣어라.\n\n';
    head += steer.map((s) => `- [${s.time}${s.from !== 'human' ? ` · from ${s.from}` : ''}] ${s.text}`).join('\n');
    head += '\n\n---\n\n';
  }
  const ps = planStats();
  const info = [`iteration=${iter}`, `mode=${mode}`, `현재 시각=${clock()}`];
  if (untilTs) info.push(`루프 종료 예정=${clock(new Date(untilTs))} (남은 시간 ${fmtDur(untilTs - Date.now())})`);
  info.push(`계획 진행=${ps.done}/${ps.total} (P0 미완료 ${ps.p0open})`);
  return { prompt: `${head}${base}\n\n---\n[runner 정보] ${info.join(' · ')}\n`, steer };
}

// ───────────────────────── claude 실행 ─────────────────────────
let currentChild = null;
let stopRequested = false;

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (IS_WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    try { child.kill('SIGKILL'); } catch {}
  }
}

const winQuote = (a) => (/[\s&|<>^"]/.test(a) ? `"${String(a).replace(/"/g, '""')}"` : a);
const toText = (c) => (Array.isArray(c) ? c.map((x) => x?.text ?? '').join(' ') : String(c ?? ''));
function describeTool(name, input = {}) {
  const rel = (p) => (p ? path.relative(ROOT, String(p)) || String(p) : '');
  switch (name) {
    case 'Bash': case 'PowerShell': return oneLine(input.command, 140);
    case 'Read': case 'Write': case 'Edit': case 'MultiEdit': case 'NotebookEdit':
      return rel(input.file_path || input.notebook_path);
    case 'Glob': case 'Grep': return oneLine(input.pattern, 100);
    case 'Task': case 'Agent': return oneLine(input.description || input.subagent_type || '', 100);
    case 'TodoWrite': return `${input.todos?.length ?? 0} todos`;
    case 'WebSearch': return oneLine(input.query, 100);
    case 'WebFetch': return oneLine(input.url, 100);
    default: return oneLine(JSON.stringify(input), 100);
  }
}
function handleEvent(line, res) {
  if (!line.trim()) return;
  let ev;
  try { ev = JSON.parse(line); } catch { log(dim(oneLine(line, 200))); return; }
  const indent = ev.parent_tool_use_id ? dim('  ┆ ') : '';
  if (ev.type === 'system' && ev.subtype === 'init') {
    log(dim(`model ${ev.model ?? '?'} · session ${String(ev.session_id ?? '').slice(0, 8)}`));
  } else if (ev.type === 'assistant') {
    for (const c of ev.message?.content || []) {
      if (c.type === 'text' && c.text?.trim()) log(`${indent}${cyan('›')} ${oneLine(c.text, 240)}`);
      else if (c.type === 'tool_use') {
        res.tools++;
        log(`${indent}${yellow('$')} ${bold(c.name)} ${dim(describeTool(c.name, c.input))}`);
      }
    }
  } else if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
    for (const c of ev.message.content) {
      if (c.type === 'tool_result' && c.is_error) log(`${indent}${red(`  ✗ ${oneLine(toText(c.content), 180)}`)}`);
    }
  } else if (ev.type === 'result') {
    res.result = ev;
  }
}

function runClaude({ prompt, mode, iter, opts }) {
  return new Promise((resolve) => {
    const bin = process.env.CLAUDE_BIN || 'claude';
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
    args.push(...(opts.safe ? ['--permission-mode', 'acceptEdits'] : ['--dangerously-skip-permissions']));
    if (fs.existsSync(SETTINGS)) args.push('--settings', path.relative(ROOT, SETTINGS).split(path.sep).join('/'));
    if (opts.model) args.push('--model', String(opts.model));
    args.push(...opts.extra);

    const logFile = path.join(LOGS, `iter-${String(iter).padStart(3, '0')}-${mode}.jsonl`);
    const out = fs.createWriteStream(logFile);
    const res = { code: null, result: null, stderr: '', timedOut: false, spawnError: null, logFile, tools: 0 };
    let finished = false;
    const finish = () => { if (finished) return; finished = true; currentChild = null; out.end(); resolve(res); };

    let child;
    try {
      const spawnOpts = {
        cwd: ROOT,
        detached: !IS_WIN, // Unix: 프로세스 그룹째로 종료할 수 있게
        env: { ...process.env, RALPH_MODE: mode, RALPH_ITER: String(iter) },
        stdio: ['pipe', 'pipe', 'pipe'],
      };
      // Windows: claude.cmd / claude.exe 둘 다 찾도록 셸 경유 (명령 문자열 하나로 넘겨야 경고가 안 뜸)
      child = IS_WIN
        ? spawn([bin, ...args].map(winQuote).join(' '), { ...spawnOpts, shell: true })
        : spawn(bin, args, spawnOpts);
    } catch (e) { res.spawnError = e; return finish(); }
    currentChild = child;

    const timer = setTimeout(() => {
      res.timedOut = true;
      log(red(`iteration 제한시간 ${opts.timeout}분 초과 → 강제 종료`));
      killTree(child);
    }, opts.timeout * 60_000);

    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      out.write(chunk);
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { handleEvent(buf.slice(0, i), res); buf = buf.slice(i + 1); }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => { res.stderr = (res.stderr + c).slice(-20000); });
    child.on('error', (e) => { res.spawnError = e; clearTimeout(timer); if (!child.pid) finish(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buf.trim()) handleEvent(buf, res);
      res.code = code;
      finish();
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt, 'utf8');
  });
}

function classify(r) {
  if (r.spawnError && r.code === null) return 'fatal';
  if (r.timedOut) return 'timeout';
  const failed = r.code !== 0 || !r.result || r.result.is_error === true || String(r.result.subtype || '').startsWith('error');
  const text = `${r.result?.result ?? ''}\n${r.stderr}`;
  if (failed && /usage limit|limit reached|rate[ _-]?limit|too many requests|\b429\b|overloaded|\b529\b/i.test(text)) return 'ratelimit';
  if (failed && /invalid api key|not logged in|\/login|authenticat|unauthorized|\b401\b|oauth token/i.test(text)) return 'auth';
  if (failed && /command not found|is not recognized|ENOENT/i.test(text) && !r.result) return 'fatal';
  return failed ? 'error' : 'ok';
}
function rateLimitWait(r, fallbackMs) {
  const text = `${r.result?.result ?? ''}\n${r.stderr}`;
  const epoch = text.match(/\|(\d{10})\b/);
  if (epoch) {
    const ms = Number(epoch[1]) * 1000 - Date.now() + 30_000;
    if (ms > 0 && ms < 6 * 3600_000) return ms;
  }
  const m = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (m) {
    let h = Number(m[1]);
    if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
    const t = new Date();
    t.setHours(h, Number(m[2] || 0), 30, 0);
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
    const ms = t.getTime() - Date.now();
    if (ms < 6 * 3600_000) return ms;
  }
  return fallbackMs;
}
async function waitOrStop(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (stopRequested || fs.existsSync(FILES.stop)) return;
    await sleep(Math.min(5000, end - Date.now()));
  }
}
function parseUntil(s) {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) { log(red(`--until 형식은 HH:MM (받은 값: ${s})`)); process.exit(1); }
  const t = new Date();
  t.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1); // 이미 지난 시각이면 다음 날
  return t.getTime();
}

// ───────────────────────── 메인 루프 ─────────────────────────
async function runLoop(mode, opts) {
  ensureDirs();
  const touchesRepo = mode !== 'qa'; // 단독 QA는 빌더와 병렬로 돌 수 있으니 git을 건드리지 않음
  if (touchesRepo) { ensureGit(); fs.rmSync(FILES.stop, { force: true }); }

  const max = Number(opts.max ?? (mode === 'build' ? 200 : 1));
  const untilTs = opts.until ? parseUntil(opts.until) : opts.for ? Date.now() + Number(opts.for) * 60_000 : null;
  opts.timeout = Number(opts.timeout ?? 30);
  const stallLimit = Number(opts.stall ?? 3);
  const qaEvery = mode === 'build' ? Number(opts['qa-every'] ?? 5) : 0;
  const MAX_ERRORS = 3;

  console.log('');
  log(bold(`랄프 루프 시작 · ${mode.toUpperCase()}`) + dim(` · ${ROOT}`));
  log(dim([
    `max ${max}`,
    untilTs ? `until ${clock(new Date(untilTs))} (${new Date(untilTs).toLocaleDateString()})` : 'until 없음',
    `iteration 제한 ${opts.timeout}분`,
    mode === 'build' ? `QA ${qaEvery ? `${qaEvery}회마다` : '끔'}` : null,
    opts.model ? `model ${opts.model}` : null,
    opts.safe ? '권한: acceptEdits + claude-settings.json 허용목록' : '권한: skip-permissions',
  ].filter(Boolean).join(' · ')));
  if (!opts.safe) log(yellow('권한 확인 없이 실행 중. 이 폴더 전용 프로젝트에서만 쓸 것.'));
  log(dim('조향: 다른 터미널에서 `node scripts/ralph.mjs say "..."` · 멈춤: `... stop` (Ctrl+C는 현재 작업까지 끊김)'));

  const queue = []; // 강제로 끼워 넣을 모드 (plan/qa)
  if (mode === 'build' && planStats().total === 0) {
    log(yellow('계획이 비어 있음 → plan 먼저 1회'));
    queue.push('plan');
  }

  const stats = { iters: 0, commits: 0, cost: 0, t0: Date.now() };
  let stall = 0, replanned = false, errors = 0, backoff = 60_000, sinceQa = 0, pauseNoted = false;

  while (stats.iters < max) {
    if (stopRequested || fs.existsSync(FILES.stop)) { log(yellow('STOP 요청 → 루프 종료')); break; }
    if (untilTs && Date.now() >= untilTs) { log(yellow(`종료 시각 ${clock(new Date(untilTs))} 도달 → 새 iteration 시작 안 함`)); break; }
    if (fs.existsSync(FILES.pause)) {
      if (!pauseNoted) { log(magenta('PAUSE 중… (`node scripts/ralph.mjs resume`으로 재개)')); pauseNoted = true; }
      await sleep(3000);
      continue;
    }
    pauseNoted = false;

    const curMode = queue.shift() || mode;
    const iter = nextIter();
    const { prompt, steer } = buildPrompt(curMode, iter, untilTs);
    console.log('');
    log(bold(magenta(`━━ iter ${iter} · ${curMode.toUpperCase()} ━━`)) + (steer.length ? yellow(` · 실시간 지시 ${steer.length}개 주입`) : ''));

    const before = touchesRepo ? headSha() : '';
    const t = Date.now();
    const r = await runClaude({ prompt, mode: curMode, iter, opts });
    const dur = Date.now() - t;
    const kind = classify(r);

    if (kind === 'ratelimit') {
      const wait = rateLimitWait(r, backoff);
      log(yellow(`사용량/속도 제한 → ${fmtDur(wait)} 기다렸다 재시도 (이번 건 iteration으로 안 셈)`));
      bell();
      queue.unshift(curMode);
      await waitOrStop(wait);
      backoff = Math.min(backoff * 2, 15 * 60_000);
      continue;
    }
    backoff = 60_000;
    if (kind === 'fatal') {
      log(red(`claude 실행 실패: ${r.spawnError?.message ?? oneLine(r.stderr, 200)}`));
      log(red('Claude Code 설치·PATH 확인. 경로가 특이하면 CLAUDE_BIN 환경변수로 지정.'));
      break;
    }
    if (kind === 'auth') { log(red('인증 오류 → 터미널에서 `claude` 한 번 실행해 로그인 상태 확인')); bell(); break; }

    consumeSteer(steer);
    const agentCommits = touchesRepo ? commitsSince(before) : 0;
    let snap = false;
    if (touchesRepo && isDirty()) {
      git(['add', '-A']);
      snap = git(['commit', '-q', '-m', `wip: ralph iter ${iter} snapshot (${curMode}/${kind})`, '--no-verify']).ok;
    }
    const cost = Number(r.result?.total_cost_usd || 0);
    if (curMode === mode) stats.iters++;
    stats.commits += agentCommits;
    stats.cost += cost;

    const ps = planStats();
    log(`${bold(`■ iter ${iter} 끝`)} · ${fmtDur(dur)} · turns ${r.result?.num_turns ?? '-'} · tools ${r.tools}`
      + ` · commits ${agentCommits}${snap ? '+wip' : ''} · plan ${ps.done}/${ps.total}`
      + ` · ${kind === 'ok' ? green('ok') : red(kind)}${cost ? dim(` · $${cost.toFixed(2)}`) : ''}`);
    if (r.result?.result) log(dim(`  결과: ${oneLine(r.result.result, 300)}`));
    if (kind !== 'ok' && r.stderr.trim()) log(dim(`  stderr: ${oneLine(r.stderr.slice(-500), 300)}`));
    appendRun({
      iter, mode: curMode, kind, start: new Date(t).toISOString(), durMs: dur,
      turns: r.result?.num_turns ?? null, commits: agentCommits, cost, plan: `${ps.done}/${ps.total}`,
    });

    if (kind === 'ok') errors = 0;
    else if (++errors >= MAX_ERRORS) {
      log(red(`연속 ${errors}회 실패 → 중단. 로그: ${path.relative(ROOT, r.logFile)}`));
      bell();
      break;
    }

    if (curMode === 'build') {
      if (kind === 'ok' && claimsDone(r)) {
        const v = verifyDone();
        if (v.ok) { log(green(bold('✔ RALPH_DONE 검증 통과 — 계획 전부 완료'))); bell(); break; }
        log(yellow(`RALPH_DONE 선언했지만 검증 실패: ${v.reason} → 계속 일 시킴`));
        addSteer(`너는 RALPH_DONE을 출력했지만 runner 검증에서 실패했다: ${v.reason}`
          + `${v.tail ? `\n\`\`\`\n${v.tail}\n\`\`\`` : ''}\n이것부터 고쳐라.`, 'runner');
      }
      if (agentCommits > 0) { stall = 0; replanned = false; }
      else if (++stall >= stallLimit) {
        if (!replanned) {
          log(yellow(`${stall}회 연속 커밋 없음 → plan 1회 자동 실행 후 계속`));
          queue.push('plan');
          replanned = true;
          stall = 0;
        } else {
          log(red('재계획 후에도 진전 없음 → 중단. `status`와 .ralph/logs 확인 후 say로 방향 잡아줄 것'));
          bell();
          break;
        }
      }
      if (qaEvery > 0 && ++sinceQa >= qaEvery) { queue.push('qa'); sinceQa = 0; }
    }
  }

  console.log('');
  log(bold(`루프 종료 · ${mode} ${stats.iters}회 · ${fmtDur(Date.now() - stats.t0)} · 에이전트 커밋 ${stats.commits}`)
    + (stats.cost ? dim(` · $${stats.cost.toFixed(2)}`) : ''));
}

// ───────────────────────── 보조 명령 ─────────────────────────
function status() {
  const ps = planStats();
  console.log(`${bold('■ 계획')} ${ps.done}/${ps.total} 완료 · 미완료 ${ps.open} (P0 ${ps.p0open})`);
  const flags = [fs.existsSync(FILES.pause) && 'PAUSE', fs.existsSync(FILES.stop) && 'STOP'].filter(Boolean);
  if (flags.length) console.log(`${bold('■ 플래그')} ${yellow(flags.join(', '))}`);
  const steer = pendingSteer();
  console.log(`${bold('■ 대기 중인 지시')} ${steer.length}개`);
  for (const s of steer) console.log(`  - [${s.time} · ${s.from}] ${oneLine(s.text, 120)}`);
  try {
    const runs = fs.readFileSync(FILES.runs, 'utf8').trim().split('\n').slice(-6).map((l) => JSON.parse(l));
    console.log(bold('■ 최근 iteration'));
    for (const r of runs) {
      console.log(`  #${r.iter} ${r.mode.padEnd(5)} ${clock(new Date(r.start))} ${fmtDur(r.durMs).padStart(7)} commits ${r.commits} plan ${r.plan} ${r.kind === 'ok' ? green('ok') : red(r.kind)}`);
    }
  } catch {}
  try {
    const lines = fs.readFileSync(FILES.progress, 'utf8').trim().split('\n').filter((l) => l.startsWith('- ')).slice(-8);
    if (lines.length) { console.log(bold('■ PROGRESS.md')); for (const l of lines) console.log(`  ${l}`); }
  } catch {}
  const gl = git(['log', '--oneline', '-8']);
  if (gl.ok && gl.out) { console.log(bold('■ git log')); for (const l of gl.out.split('\n')) console.log(`  ${l}`); }
}

function help() {
  console.log(`
${bold('랄프 루프 runner (Claude Code)')}

  node scripts/ralph.mjs plan  [--max 1]          specs → IMPLEMENTATION_PLAN.md (코드 안 씀)
  node scripts/ralph.mjs build [옵션]             1 iteration = 작업 1개, 반복
  node scripts/ralph.mjs qa    [--max 1]          QA 1회 (코드 수정 없이 문제를 say로 보고)
  node scripts/ralph.mjs say 지시 내용             돌고 있는 루프의 다음 iteration 맨 앞에 지시 주입
  node scripts/ralph.mjs status                   계획 진행·최근 iteration·로그 요약
  node scripts/ralph.mjs pause | resume | stop    다음 iteration 전에 멈춤 / 재개 / 종료

${bold('build 옵션')}
  --until HH:MM      이 시각 이후로는 새 iteration 시작 안 함 (예: --until 16:40)
  --for 분           지금부터 N분 동안 (until 대신)
  --max N            최대 iteration 수 (기본 200)
  --timeout 분       iteration 1회 제한시간 (기본 30)
  --qa-every N       build N회마다 QA 1회 끼워넣기 (기본 5, 0이면 끔)
  --stall N          N회 연속 커밋 없으면 자동 재계획, 또 막히면 중단 (기본 3)
  --model 이름       예: opus, sonnet
  --safe             skip-permissions 대신 acceptEdits + scripts/claude-settings.json 허용목록
  -- ...             뒤에 오는 인자는 claude에 그대로 전달

${bold('환경변수')}  CLAUDE_BIN=claude 실행 파일 경로 (기본 claude)
`);
}

// ───────────────────────── 진입점 ─────────────────────────
process.on('SIGINT', () => {
  if (!stopRequested) {
    stopRequested = true;
    log(yellow('Ctrl+C → 현재 iteration 끝나면 종료. 즉시 끝내려면 한 번 더.'));
    return;
  }
  log(red('즉시 종료'));
  if (currentChild) killTree(currentChild);
  process.exit(130);
});

const { cmd, opts } = parseArgs(process.argv.slice(2));
switch (cmd) {
  case 'plan': case 'build': case 'qa':
    await runLoop(cmd, opts);
    break;
  case 'say': {
    const text = process.argv.slice(3).join(' ').trim();
    if (!text) { console.log('사용법: node scripts/ralph.mjs say 지시 내용'); process.exit(1); }
    const from = process.env.RALPH_MODE === 'qa' ? 'qa' : 'human';
    addSteer(text, from);
    log(green(`지시 등록 (${from}) → 다음 iteration 맨 앞에 들어감 · 대기 ${pendingSteer().length}개`));
    break;
  }
  case 'pause':
    ensureDirs(); fs.writeFileSync(FILES.pause, clock());
    log('PAUSE — 지금 iteration은 끝까지 돌고, 다음 iteration 전에 멈춤');
    break;
  case 'resume':
    fs.rmSync(FILES.pause, { force: true });
    log('재개');
    break;
  case 'stop':
    ensureDirs(); fs.writeFileSync(FILES.stop, clock());
    log('STOP — 지금 iteration 끝나면 루프 종료');
    break;
  case 'status':
    status();
    break;
  default:
    help();
}
