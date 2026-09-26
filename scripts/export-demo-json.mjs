/**
 * Exporte les données de démonstration (seed + migrations v2) et les référentiels
 * en JSON pour le backend Django : backend/demo/demo.json.
 * Relancer après chaque node scripts/extract-reference.mjs :
 *   node scripts/export-demo-json.mjs
 */
import { writeFileSync } from 'node:fs'
import { seed } from '../src/data/seed.ts'
import { migrateDemo } from '../src/data/migrations.ts'
import * as ref from '../src/data/referentiels.ts'

const out = {
  today: ref.TODAY.toISOString(),
  norms: ref.NORMS,
  org: ref.ORG,
  users: ref.USERS,
  directions: ref.DIRECTIONS,
  roles: ref.ROLES,
  db: migrateDemo(structuredClone(seed)),
}
writeFileSync('backend/demo/demo.json', JSON.stringify(out, null, 1) + '\n')
console.log('backend/demo/demo.json :', Object.keys(out.db).length, 'collections')
