// loader.js — loads and merges the game catalog.
// Usage (from a <script type="module"> or your app):
//     import { loadGameData } from "./loader.js";
//     const catalog = await loadGameData();
//     catalog.species.get("aarakocra");           // one entry
//     [...catalog.spells.values()];               // all spells
//     catalog.spellsForClass("wizard");           // derived spell list

const TYPES = ["species", "classes", "backgrounds", "spells"];

// Required fields per type — the load-time safety net that catches typos at scale.
const REQUIRED = {
  species:     ["id", "name", "speed"],
  classes:     ["id", "name", "hd", "saves"],
  backgrounds: ["id", "name", "skills"],
  spells:      ["id", "name", "level"]
};

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

function indexById(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.id) { console.warn("Skipping entry with no id:", e); continue; }
    if (map.has(e.id)) console.warn(`Duplicate id "${e.id}" — later one wins.`);
    map.set(e.id, e);
  }
  return map;
}

// Homebrew overrides core. Existing id => shallow-merge (homebrew fields win),
// so you can override just { id, name } to rename. New id => added.
function applyOverrides(coreMap, overrides) {
  for (const o of overrides) {
    if (!o.id) continue;
    const base = coreMap.get(o.id) || {};
    coreMap.set(o.id, { ...base, ...o, source: o.source || base.source || "Homebrew" });
  }
}

function validate(type, map) {
  const problems = [];
  for (const [id, e] of map) {
    for (const field of REQUIRED[type]) {
      if (e[field] === undefined) problems.push(`${type}/${id} is missing "${field}"`);
    }
  }
  return problems;
}

export async function loadGameData(opts = {}) {
  const dataDir = opts.dataDir || "data";
  const homebrewPath = opts.homebrew || "homebrew.json";

  // 1. Load each content type into its own Map keyed by id.
  const catalog = {};
  for (const type of TYPES) {
    const file = await fetchJSON(`${dataDir}/${type}.json`);
    catalog[type] = indexById(file.entries || []);
  }

  // 2. Layer homebrew on top (renames + additions).
  try {
    const homebrew = await fetchJSON(homebrewPath);
    for (const type of TYPES) {
      if (Array.isArray(homebrew[type])) applyOverrides(catalog[type], homebrew[type]);
    }
  } catch (e) {
    console.info("No homebrew applied:", e.message);
  }

  // 3. Validate: required fields + referential integrity.
  const problems = [];
  for (const type of TYPES) problems.push(...validate(type, catalog[type]));
  for (const [id, sp] of catalog.spells) {
    for (const cid of (sp.classes || [])) {
      if (!catalog.classes.has(cid)) problems.push(`spells/${id} references unknown class "${cid}"`);
    }
  }
  if (problems.length) console.warn("Catalog validation issues:\n  " + problems.join("\n  "));

  // 4. Convenience: a class's spell list is derived, never hand-maintained.
  catalog.spellsForClass = (classId) =>
    [...catalog.spells.values()]
      .filter(s => (s.classes || []).includes(classId))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return catalog;
}
