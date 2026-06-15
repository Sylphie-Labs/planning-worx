#!/usr/bin/env node
'use strict';
const { install } = require('../lib/install.js');
const pkg = require('../package.json');

const args = process.argv.slice(2);
const cmd = args[0] || 'init';

if (args.includes('-h') || args.includes('--help')) {
  console.log(`planning-worx ${pkg.version}

Usage:
  npx planning-worx init      Install the planning framework into the current repo.
  npx planning-worx --help    Show this help.

What init does (idempotent — safe to re-run to update):
  - installs the Claude plugin bundle under .claude/planning-worx-plugin/
  - scaffolds planning/ (contract.yaml, contract.schema.json, vision.md, rules)
    without overwriting an existing contract.yaml or vision.md
  - enables the plugin via two additive keys in .claude/settings.json
  - adds one marker-wrapped @import line to CLAUDE.md (your content untouched)
`);
  process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) { console.log(pkg.version); process.exit(0); }

if (cmd !== 'init') {
  console.error(`Unknown command: ${cmd}\nRun \`npx planning-worx --help\`.`);
  process.exit(1);
}

try {
  install(process.cwd());
} catch (e) {
  console.error('planning-worx: install failed — ' + e.message);
  process.exit(1);
}
