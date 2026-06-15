'use strict';
// planning-worx installer — copies the plugin bundle + planning data into a repo
// and wires it up with the lightest possible touch to existing files:
//   - .claude/planning-worx-plugin/   <- the plugin bundle (managed; overwritten on re-init)
//   - planning/                       <- contract + schema + vision (USER DATA never overwritten)
//   - .claude/settings.json           <- two additive keys (marketplace + enable), merged idempotently
//   - CLAUDE.md                       <- one marker-wrapped @import line, appended idempotently

const fs = require('fs');
const path = require('path');

const MP_DIR = '.claude/planning-worx-plugin';        // local marketplace root (managed)
const MP_NAME = 'planning-worx-local';
const PLUGIN_REF = 'planning-worx@' + MP_NAME;
const BEGIN = '<!-- BEGIN planning-worx -->';
const END = '<!-- END planning-worx -->';
const IMPORT_LINE = '@planning/planning-worx.rules.md';
// planning/ files that are USER DATA — never overwrite once present:
const PRESERVE = new Set(['contract.yaml', 'vision.md']);

function log(msg) { process.stdout.write(msg + '\n'); }

function copyDir(src, dest, { preserve = null } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) { copyDir(s, d, { preserve }); continue; }
    if (preserve && preserve.has(entry.name) && fs.existsSync(d)) {
      log(`  kept   ${path.relative(process.cwd(), d)} (exists; not overwritten)`);
      continue;
    }
    fs.copyFileSync(s, d);
  }
}

function mergeSettings(target) {
  const dir = path.join(target, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'settings.json');
  let settings = {};
  if (fs.existsSync(file)) {
    try { settings = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; }
    catch (e) {
      const bak = file + '.bak';
      fs.copyFileSync(file, bak);
      log(`  note   .claude/settings.json was not valid JSON; backed up to ${path.basename(bak)} and rewrote keys.`);
      settings = {};
    }
  }
  settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
  settings.extraKnownMarketplaces[MP_NAME] = { source: { source: 'directory', path: './' + MP_DIR } };
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins[PLUGIN_REF] = true;
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  log('  merged .claude/settings.json (enabled planning-worx plugin; existing keys preserved)');
}

function injectClaudeMd(target) {
  const file = path.join(target, 'CLAUDE.md');
  const block = `${BEGIN}\n${IMPORT_LINE}\n${END}`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `# Project memory\n\n${block}\n`);
    log('  wrote  CLAUDE.md (with planning-worx rules import)');
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (re.test(content)) {
    content = content.replace(re, block);
    fs.writeFileSync(file, content);
    log('  updated CLAUDE.md planning-worx block (in place)');
  } else {
    if (!content.endsWith('\n')) content += '\n';
    content += `\n${block}\n`;
    fs.writeFileSync(file, content);
    log('  appended planning-worx import to existing CLAUDE.md (your content untouched)');
  }
}

function install(target) {
  const payload = path.join(__dirname, '..', 'payload');
  if (!fs.existsSync(payload)) throw new Error('payload/ not found next to installer.');

  log('planning-worx: installing into ' + target);

  // 1) plugin bundle (managed — refreshed each run)
  copyDir(path.join(payload, 'plugin'), path.join(target, MP_DIR));
  log('  copied ' + MP_DIR + ' (plugin: commands, skills, agents, hooks, scripts)');

  // 2) planning data (preserve user data; refresh managed schema + rules)
  copyDir(path.join(payload, 'planning'), path.join(target, 'planning'), { preserve: PRESERVE });
  log('  copied planning/ (contract.schema.json + rules refreshed; your contract.yaml/vision.md preserved)');

  // 3) settings.json — additive enable
  mergeSettings(target);

  // 4) CLAUDE.md — one import line
  injectClaudeMd(target);

  // 5) gitignore the derived state file (best-effort, idempotent)
  try {
    const gi = path.join(target, '.gitignore');
    const line = 'planning/.state.json';
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!cur.split(/\r?\n/).includes(line)) {
      fs.writeFileSync(gi, (cur && !cur.endsWith('\n') ? cur + '\n' : cur) + line + '\n');
    }
  } catch (e) {}

  log('\nDone. Next steps:');
  log('  1. Fill in planning/vision.md (problem, outcome, feature list).');
  log('  2. Open `claude` in this folder. If prompted, trust the folder / enable the planning-worx plugin.');
  log('  3. Run:  /plan-constitution  ->  /plan-vision  ->  /plan-clarify  ->  /plan-design');
  log('           ->  /plan-tickets   ->  /plan-analyze   (then /plan-ticket <id> to build)');
  log('     Use /plan-status anytime, /plan-check to validate the contract.');
}

module.exports = { install };
