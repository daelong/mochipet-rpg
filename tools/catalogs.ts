import { readFile, writeFile } from 'node:fs/promises';
import {
  CHARACTERS,
  SKILLS,
  MONSTERS,
  SHOP,
  ZONES,
  HOME_ACTIVITIES,
  HUNTING_RULES,
} from '../packages/game-data/src/index';
function csv(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
  return (
    [keys.map(cell).join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join(
      '\n',
    ) + '\n'
  );
}
const catalogs = {
  'web-characters.csv': CHARACTERS.map((c) => ({
    id: c.id,
    group: c.group,
    name: c.name,
    animal: c.animal,
    skill_id: c.skillId,
    attack: c.stats.attack,
    defense: c.stats.defense,
    agility: c.stats.agility,
    hp: c.stats.hp,
    asset_directory: `assets/pets/${c.id}/`,
  })),
  'web-skills.csv': SKILLS.map((s) => ({ ...s })),
  'web-monsters.csv': MONSTERS.map((m) => ({ ...m })),
  'web-zones.csv': ZONES.map((z) => ({
    id: z.id,
    name: z.name,
    unlock_level: z.level,
    monster_ids: z.monsters.join(';'),
    max_monsters: HUNTING_RULES.maxMonsters,
    respawn_seconds: HUNTING_RULES.respawnSeconds,
  })),
  'web-shop.csv': SHOP.map((i) => ({ ...i })),
  'web-home-activities.csv': HOME_ACTIVITIES.map((a) => ({
    ...a,
    effects: JSON.stringify(a.effects),
  })),
};
for (const [name, rows] of Object.entries(catalogs)) {
  const path = new URL(`../docs/catalogs/${name}`, import.meta.url);
  const next = csv(rows);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== next)
      throw new Error(`${name} is stale; run pnpm catalogs`);
  } else await writeFile(path, next);
}
console.log(
  process.argv.includes('--check')
    ? 'Web catalogs match runtime data.'
    : `Wrote ${Object.keys(catalogs).length} read-only web catalogs.`,
);
