#!/usr/bin/env node

// Structure validator for the H5G Game Graphics & Audio plugin.
// Run from the plugin root:  node scripts/validate-plugin.mjs
// Mirrors the h5g-slot-math validator, adapted to this suite's `references/<file>.md` citation style
// (refs are cited in prose/backticks, not markdown links).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const placeholderMarkers = ["TO" + "DO", "FIX" + "ME", "T" + "BD", "\\[" + "INSERT", "<" + "placeholder>"];

const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function parseJson(p) {
  try { return JSON.parse(read(p)); }
  catch (e) { fail(`${p}: invalid JSON: ${e.message}`); return null; }
}

const manifest = parseJson(".claude-plugin/plugin.json");
if (!manifest) process.exit(1);

if (!/^[a-z0-9-]+$/.test(manifest.name || "")) {
  fail(".claude-plugin/plugin.json: name must be kebab-case");
}
for (const field of ["displayName", "version", "description"]) {
  if (!manifest[field]) fail(`.claude-plugin/plugin.json: missing ${field}`);
}
if ((manifest.skills || []).some((s) => String(s).startsWith("./skills/"))) {
  fail(".claude-plugin/plugin.json: do not list ./skills/* entries; skills are auto-discovered");
}

// Discover skills under skills/.
const skillDirs = exists("skills")
  ? fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

if (skillDirs.length === 0) fail("no skills found under skills/");

let refCount = 0;
for (const name of skillDirs) {
  const skillFile = `skills/${name}/SKILL.md`;
  if (!exists(skillFile)) { fail(`missing skill entrypoint: ${skillFile}`); continue; }

  const content = read(skillFile);
  const lines = content.split(/\r?\n/).length;
  if (lines > 500) fail(`${skillFile}: exceeds 500 lines (${lines})`);
  if (!content.startsWith("---")) fail(`${skillFile}: missing YAML frontmatter`);

  const desc = content.match(/^description:\s*(.+)$/m);
  if (!desc || desc[1].replace(/^["']|["']$/g, "").trim().length < 40) {
    fail(`${skillFile}: description missing or too thin`);
  }
  if (!/^name:\s*[a-z0-9-]+\s*$/m.test(content)) {
    fail(`${skillFile}: missing kebab-case name in frontmatter`);
  }
  if (new RegExp(`\\b(${placeholderMarkers.join("|")})\\b`, "i").test(content)) {
    fail(`${skillFile}: contains placeholder marker`);
  }

  // Reference citations: `references/<file>.md` tokens must resolve in this skill dir.
  const refs = [...content.matchAll(/references\/([A-Za-z0-9._-]+\.md)/g)]
    .map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  for (const ref of refs) {
    refCount++;
    if (!exists(`skills/${name}/references/${ref}`)) {
      fail(`${skillFile}: cited reference not found: references/${ref}`);
    }
  }
}

// Hooks: standard auto-loaded file must be valid and the orchestrator must exist.
if (exists("hooks/hooks.json")) {
  const hooks = parseJson("hooks/hooks.json");
  if (hooks && !hooks.hooks) fail("hooks/hooks.json: missing top-level hooks object");
} else {
  warn("hooks/hooks.json not found (plugin will ship without the orchestration hook)");
}
const hookScript = "hooks/graphics-suite-orchestrator.mjs";
if (!exists(hookScript)) fail(`missing hook script: ${hookScript}`);
else if (!read(hookScript).includes("UserPromptSubmit")) warn(`${hookScript}: no UserPromptSubmit mention`);

if (warnings.length) {
  console.log("Warnings:");
  for (const m of warnings) console.log(`- ${m}`);
}
if (errors.length) {
  console.error("Validation failed:");
  for (const m of errors) console.error(`- ${m}`);
  process.exit(1);
}
console.log(`OK: ${skillDirs.length} skills, ${refCount} references checked. Plugin structure validated.`);
