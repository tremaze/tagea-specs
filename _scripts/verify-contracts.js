#!/usr/bin/env node
/**
 * verify-contracts.js — detect drift between spec contracts and Angular source.
 *
 * What it does:
 *   For each specs/features/<slug>/contracts.md, extract TypeScript identifiers
 *   from fenced code blocks (enum values, interface field names, method calls)
 *   and check whether each appears anywhere under apps/tagea-frontend/src/.
 *
 *   Identifiers that cannot be found are reported as likely drift — cases where
 *   the contract references a type, field, or method that no longer exists.
 *
 * Limitations (known false-positive sources):
 *   - Common generic words ("id", "name", "data") are ignored via the skip list
 *   - Interfaces added directly in specs (UI-only types) are allowlisted by
 *     naming convention: anything starting with "Ui" or ending in "ViewModel"
 *   - Types defined purely in the .d.ts of an external library will be missed
 *
 * This tool is intentionally noisy on the side of caution — every hit should
 * still be reviewed by a human. Its job is to catch obvious field renames
 * and deleted methods, not to produce a clean green bar.
 *
 * Usage:
 *   node specs/_scripts/verify-contracts.js              # all features
 *   node specs/_scripts/verify-contracts.js login        # single feature slug
 *   node specs/_scripts/verify-contracts.js --strict     # fail exit code on any finding
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPECS_DIR = path.join(REPO_ROOT, 'specs', 'features');
const SRC_DIR = path.join(REPO_ROOT, 'apps', 'tagea-frontend', 'src');

// Identifiers that are too generic to grep reliably.
const SKIP_IDENTIFIERS = new Set([
  'id',
  'name',
  'type',
  'data',
  'value',
  'key',
  'label',
  'title',
  'status',
  'date',
  'time',
  'error',
  'message',
  'content',
  'body',
  'item',
  'items',
  'result',
  'response',
  'request',
  'page',
  'total',
  'count',
  'size',
  'limit',
  'email',
  'phone',
  'address',
  'category',
  'url',
  'text',
  'icon',
  'number',
  'string',
  'boolean',
  'null',
  'undefined',
  'any',
  'unknown',
  'Date',
  'Promise',
  'Observable',
  'Record',
  'Array',
  'Map',
  'Set',
  'File',
  'void',
  'true',
  'false',
  // Extremely common enum values that appear in many unrelated places
  'new',
  'read',
  'open',
  'closed',
  'active',
  'inactive',
]);

// Symbols allowed to be declared only inside a spec (UI-only, not a backend contract).
const UI_ONLY_PATTERNS = [
  /^Ui[A-Z]/, // UiFoo
  /ViewModel$/, // FooViewModel
  /CombinedItem$/, // discriminated unions used only in lists
  /^Form[A-Z]/, // FormData holders
];

// --- Arg parsing ---

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.find((a) => !a.startsWith('--'));

// --- Symbol extraction ---

// Dart / Flutter identifiers that show up in code blocks attached to
// "Flutter port note:" / "Flutter port:" paragraphs. These describe the
// Flutter target, not the Angular source, so they are allowlisted.
const FLUTTER_API_IDENTIFIERS = new Set([
  // GoRouter
  'goNamed',
  'go',
  'push',
  'pushNamed',
  'pop',
  'pushReplacement',
  // Riverpod / Bloc
  'watch',
  'read',
  'listen',
  'select',
  // Common Flutter widgets / APIs
  'showDialog',
  'showModalBottomSheet',
  'Navigator',
  'of',
  'canPop',
  // Dart packages
  'dio',
  'flutter_appauth',
  'flutter_secure_storage',
  'file_picker',
]);

function extractCodeBlocks(md) {
  const blocks = [];
  // Regex captures:
  //   1. Optional preceding blockquote paragraph (used to flag Flutter port notes
  //      or documentation-only shapes)
  //   2. Fence language (if any)
  //   3. Body
  // Prelude = one or more blockquote lines, optionally followed by blank lines
  // before the code fence.
  const preludeRe = /(?:>[^\n]*\n)+\s*\n?/;
  const re = new RegExp(
    `(${preludeRe.source})?\`\`\`(ts|typescript|dart)?\\n([\\s\\S]*?)\\n\`\`\``,
    'g',
  );
  let m;
  while ((m = re.exec(md)) !== null) {
    const prelude = m[1] || '';
    const lang = m[2] || '';
    const body = m[3];
    const isFlutterCtx = /Flutter port/i.test(prelude) || lang === 'dart';
    const isDocOnly =
      /[Dd]ocumentation[-\s]only shape|[Dd]ocumentation shape only/i.test(
        prelude,
      );
    // Also allow an in-block opt-out marker for shapes that can't move a prelude:
    const inBlockDocOnly = /\/\/\s*documentation[-\s]only\s*$/m.test(body);
    blocks.push({
      body,
      skip: isFlutterCtx || isDocOnly || inBlockDocOnly,
    });
  }
  return blocks;
}

function extractSymbols(block) {
  const symbols = new Set();

  // interface Foo, enum Foo, type Foo
  for (const m of block.matchAll(/\b(?:interface|enum|type)\s+([A-Z]\w+)/g)) {
    symbols.add(m[1]);
  }

  // Enum string literal values:  KEY = 'value'
  for (const m of block.matchAll(/=\s*'([a-z][\w_]*)'/g)) {
    symbols.add(m[1]);
  }

  // Field names in an interface / type literal: leading whitespace, name, `?:` or `:`
  for (const m of block.matchAll(/^\s+([a-z_][\w_]*)\??:/gm)) {
    symbols.add(m[1]);
  }

  // Method / function references: `.methodName(`
  for (const m of block.matchAll(/\.([a-z][\w_]*)\s*\(/g)) {
    symbols.add(m[1]);
  }

  return symbols;
}

function extractMethodMentions(md) {
  // Catches inline backticked references like `SecureImageService.loadImage`.
  // Skips lines that belong to a Flutter port note or a documentation-only
  // disclaimer so Dart APIs (`DateTime.toLocal()` etc.) don't flag as drift.
  const symbols = new Set();
  const lines = md.split('\n');
  for (const line of lines) {
    if (/Flutter port|[Dd]ocumentation[-\s]only/.test(line)) continue;
    for (const m of line.matchAll(/`[A-Z]\w+\.([a-z][\w_]*)\s*\(/g)) {
      symbols.add(m[1]);
    }
  }
  return symbols;
}

function isUiOnly(id) {
  return UI_ONLY_PATTERNS.some((re) => re.test(id));
}

// --- Source search (uses grep via spawnSync to avoid shell parsing) ---

// Word-boundary regex built from a literal identifier. Escapes regex metachars.
function wordBoundaryPattern(identifier) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`;
}

function existsInSource(identifier) {
  // -r recursive, -E extended regex, -q quiet.
  // Word-boundary matching prevents false positives when an identifier like
  // `AppointmentDetailsService` appears only as a substring of the real
  // interface `IAppointmentDetailsService`.
  const result = spawnSync(
    'grep',
    [
      '-rEq',
      '--include=*.ts',
      '--include=*.html',
      '--exclude-dir=node_modules',
      '--',
      wordBoundaryPattern(identifier),
      SRC_DIR,
    ],
    { stdio: 'ignore' },
  );
  // grep exits 0 when matches found, 1 when no matches, 2+ on error.
  return result.status === 0;
}

// --- Verification ---

function verifyFeature(slug) {
  const contractsPath = path.join(SPECS_DIR, slug, 'contracts.md');
  if (!fs.existsSync(contractsPath)) return null;

  const md = fs.readFileSync(contractsPath, 'utf-8');
  const blocks = extractCodeBlocks(md);

  const candidates = new Set();
  for (const { body, skip } of blocks) {
    if (skip) continue; // skip Flutter port-note and documentation-only blocks
    for (const s of extractSymbols(body)) candidates.add(s);
  }
  for (const s of extractMethodMentions(md)) candidates.add(s);

  const missing = [];
  for (const id of candidates) {
    if (SKIP_IDENTIFIERS.has(id)) continue;
    if (FLUTTER_API_IDENTIFIERS.has(id)) continue;
    if (isUiOnly(id)) continue;
    if (!existsInSource(id)) missing.push(id);
  }

  missing.sort();
  return { slug, total: candidates.size, missing };
}

// --- Main ---

function listFeatureSlugs() {
  return fs
    .readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function main() {
  const slugs = only ? [only] : listFeatureSlugs();
  let totalMissing = 0;

  for (const slug of slugs) {
    const report = verifyFeature(slug);
    if (!report) {
      console.error(`skip: no contracts.md in ${slug}/`);
      continue;
    }

    const { missing, total } = report;

    if (missing.length === 0) {
      console.log(`ok    ${slug}  (${total} symbols checked)`);
    } else {
      totalMissing += missing.length;
      console.log(
        `DRIFT ${slug}  (${missing.length}/${total} not found in source):`,
      );
      for (const id of missing) console.log(`        - ${id}`);
    }
  }

  if (strict && totalMissing > 0) {
    console.error(
      `\n${totalMissing} identifier(s) not found. Exiting non-zero because --strict was set.`,
    );
    process.exit(1);
  }
}

main();
