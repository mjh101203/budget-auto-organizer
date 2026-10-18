#!/usr/bin/env node
/**
 * Claude Code Stop 훅 — 백프레셔.
 * build 루프(RALPH_MODE=build)에서 에이전트가 끝내려 할 때 `npm run check`를 돌리고,
 * 실패하면 종료를 막고(exit 2) 에러 꼬리를 에이전트에게 돌려준다.
 * - 대화형 세션, plan/qa 모드에서는 아무것도 안 함
 * - package.json에 check 스크립트가 아직 없으면(스캐폴딩 전) 통과
 * - 같은 세션에서 최대 RALPH_MAX_STOP_BLOCKS회(기본 3)만 막음 → 무한 루프 방지
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

if (process.env.RALPH_MODE !== 'build') process.exit(0);

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
const root = input.cwd || process.cwd();

let pkg;
try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { process.exit(0); }
if (!pkg?.scripts?.check) process.exit(0);

const MAX_BLOCKS = Number(process.env.RALPH_MAX_STOP_BLOCKS || 3);
const sid = String(input.session_id || 'nosession').replace(/[^\w-]/g, '').slice(0, 16);
const counterFile = path.join(root, '.ralph', `stopblock-${sid}`);
let n = 0;
try { n = Number(fs.readFileSync(counterFile, 'utf8')) || 0; } catch {}
if (n >= MAX_BLOCKS) process.exit(0);

const IS_WIN = process.platform === 'win32';
const r = spawnSync(IS_WIN ? 'npm run check' : 'npm', IS_WIN ? [] : ['run', 'check'], {
  cwd: root,
  encoding: 'utf8',
  shell: IS_WIN,
  timeout: 8 * 60_000,
  env: { ...process.env, CI: '1' },
});
if (r.status === 0) process.exit(0);

fs.mkdirSync(path.dirname(counterFile), { recursive: true });
fs.writeFileSync(counterFile, String(n + 1));
const tail = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').slice(-80).join('\n');
process.stderr.write(
  `[stop-hook] \`npm run check\` 실패 (${n + 1}/${MAX_BLOCKS}). 끝내기 전에 고쳐라. `
  + '테스트 삭제·skip·약화, 린트/타입 규칙 끄기는 금지.\n\n'
  + `${tail}\n`,
);
process.exit(2);
