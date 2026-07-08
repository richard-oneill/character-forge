# Character Forge — data architecture

This separates **content** (species, classes, backgrounds, spells) from the **engine**
(the app UI + rules math). You edit content constantly; you touch the engine rarely.
Keeping them apart is what stops one file from becoming unmanageable at hundreds of entries.

```
your-app/
├─ index.html         ← the app: UI + calculations only. No content lives here.
├─ loader.js          ← loads + merges + validates the catalog
├─ data/              ← the canonical (SRD / core) content, one file per type
│   ├─ species.json
│   ├─ classes.json
│   ├─ backgrounds.json
│   └─ spells.json
└─ homebrew.json      ← YOUR layer: renames + brand-new content, applied on top
```

## Two rules that give you "standardized, but fully customizable"

**1. Every entry has a stable `id` (a slug), separate from its display `name`.**
The `id` never changes; it's how everything else refers to the entry. The `name` is
just what's shown on screen. So to *rename* Magic Missile to "Arcane Darts", you change
the `name` field — the `id` stays `magic-missile`, and every class that lists that spell
keeps working. Renaming is a display change, never a plumbing change.

**2. Content loads in two layers: core, then homebrew on top.**
`data/*.json` is the standardized core. `homebrew.json` is merged over it by `id`:
- Same `id` as a core entry → your fields overwrite that entry (override / rename).
  Supply only the fields you're changing; the rest is inherited.
- New `id` → it's added as brand-new content.

You never edit the core files to customize. That keeps the standard clean and your
changes isolated (and trivially removable). See `homebrew.json` for a live example that
renames Magic Missile and adds a new species and spell.

## Standardization = a fixed schema per type

Required fields are enforced at load time by `loader.js` (`REQUIRED`). Anything missing a
required field, or a spell pointing at a class id that doesn't exist, prints a warning in
the browser console the moment you load — this is your typo net when you have 500 spells.

- **species**: `id, name, source, bonus{}, speed, hpPerLevel, desc, traits[]`
- **classes**: `id, name, source, hd, saves[], skillCount, skills[], cast, armor, weapons, desc, features[]`
- **backgrounds**: `id, name, source, skills[], tools[], languages, feature, desc`
- **spells**: `id, name, source, level, school, castingTime, range, components[], duration, classes[], desc`

Note spells carry `classes: [...]` — a spell declares which classes can cast it, so a
class's spell list is *derived* (`catalog.spellsForClass("wizard")`), not maintained by
hand. That's how you avoid copying spell lists into 40 different class entries.

## The one gotcha: loading needs a web server, not a double-click

Browsers block `fetch()` of local files opened via `file://`. This is not a problem once
the app is hosted (GitHub Pages, Netlify, Cloudflare Pages, any web server) — which is
where a real PWA lives anyway. For local editing, run a one-line server in this folder:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

## Catalog vs. characters — don't reach for a database yet

All of the above is *reference data*: static, read-only at runtime, and small (even 1,000
spells is a few hundred KB — it loads instantly). Flat JSON files are the right tool; a
database would be overkill. A database only earns its place for the *dynamic* data —
saved characters, and syncing them across devices or players. Keep the two concerns
separate: files for the rulebook, a datastore for the characters.

## When one spells.json gets too big

Not until it actually does. If it ever feels unwieldy, split by class or by level
(`data/spells/wizard.json`, etc.) and have the loader read the folder. The `id`-based
model means splitting changes nothing about how the rest of the app refers to a spell.
