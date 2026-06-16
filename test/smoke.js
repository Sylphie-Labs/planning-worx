#!/usr/bin/env node
'use strict';
// Smoke test: install into a temp dir, then exercise the enforcement scripts.
// Run with: npm test
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'payload', 'plugin', 'planning-worx', 'scripts');
let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }
function run(script, args, cwd) {
  try {
    const out = execFileSync('node', [path.join(SCRIPTS, script), ...args],
      { cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd }, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString() };
  } catch (e) { return { code: e.status || 1, out: (e.stdout || '').toString() + (e.stderr || '').toString() }; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-smoke-'));
execFileSync('node', [path.join(ROOT, 'bin', 'cli.js'), 'init'], { cwd: tmp, stdio: 'ignore' });

ok('install creates contract', fs.existsSync(path.join(tmp, 'planning', 'contract.yaml')));
ok('install creates plugin bundle', fs.existsSync(path.join(tmp, '.claude', 'planning-worx-plugin', 'planning-worx', 'hooks', 'hooks.json')));
ok('CLAUDE.md import injected', fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8').includes('@planning/planning-worx.rules.md'));

ok('scaffold validates', run('validate.js', [], tmp).code === 0);
ok('vision gate fails on placeholders', run('gate_check.js', ['vision'], tmp).code === 1);

// regression: hooks.json must nest events under a top-level `hooks` key (plugin schema)
const hooks = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'planning-worx-plugin', 'planning-worx', 'hooks', 'hooks.json'), 'utf8'));
ok('hooks.json wraps events under `hooks`', hooks.hooks && Array.isArray(hooks.hooks.PostToolUse));
// regression: marketplace plugin `source` must be the string form older clients support
const mp = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'planning-worx-plugin', '.claude-plugin', 'marketplace.json'), 'utf8'));
ok('marketplace source is a string', typeof mp.plugins[0].source === 'string');
// regression: plugin + marketplace versions must track package.json (no stale drift)
const pkgVer = require(path.join(ROOT, 'package.json')).version;
const pluginVer = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'planning-worx-plugin', 'planning-worx', '.claude-plugin', 'plugin.json'), 'utf8')).version;
ok('plugin.json version matches package.json', pluginVer === pkgVer);
ok('marketplace version matches package.json', mp.plugins[0].version === pkgVer);

// break the contract → validator must catch it
const cf = path.join(tmp, 'planning', 'contract.yaml');
fs.writeFileSync(cf, fs.readFileSync(cf, 'utf8').replace('kind: contract', 'kind: wrong'));
ok('validator catches invalid kind', run('validate.js', [], tmp).code === 1);

console.log(failures ? `\n${failures} failure(s).` : '\nAll smoke tests passed.');
process.exit(failures ? 1 : 0);
