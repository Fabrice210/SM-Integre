/**
 * Compare deux dossiers de captures.
 *   node scripts/visual/compare.mjs --a=<dir> --b=<dir> --out=baseline/diff
 * pixelmatch (threshold 0.1) ; PNG de diff pour chaque écart ; <out>/report.md
 * trié par % de pixels différents. Code de sortie 1 s'il y a un écart.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const { a, b } = args
const out = args.out || 'baseline/diff'
if (!a || !b || !existsSync(a) || !existsSync(b)) {
  console.error('Usage : node scripts/visual/compare.mjs --a=<dir> --b=<dir> --out=<dir>')
  process.exit(2)
}
mkdirSync(out, { recursive: true })

const OK = 0.1 // %
const pngs = (d) => new Set(readdirSync(d).filter((f) => f.endsWith('.png')))
const A = pngs(a)
const B = pngs(b)
const rows = []
const onlyA = [...A].filter((f) => !B.has(f)).sort()
const onlyB = [...B].filter((f) => !A.has(f)).sort()

for (const f of [...A].filter((f) => B.has(f)).sort()) {
  const ia = PNG.sync.read(readFileSync(join(a, f)))
  const ib = PNG.sync.read(readFileSync(join(b, f)))
  const name = f.replace(/\.png$/, '')
  if (ia.width !== ib.width || ia.height !== ib.height) {
    rows.push({ name, pct: Infinity, status: 'TAILLE DIFFÉRENTE', detail: `${ia.width}×${ia.height} ≠ ${ib.width}×${ib.height}` })
    continue
  }
  const diff = new PNG({ width: ia.width, height: ia.height })
  const n = pixelmatch(ia.data, ib.data, diff.data, ia.width, ia.height, { threshold: 0.1 })
  const pct = (n / (ia.width * ia.height)) * 100
  const status = pct <= OK ? 'OK' : 'ÉCART'
  if (n > 0) writeFileSync(join(out, f), PNG.sync.write(diff))
  rows.push({ name, pct, status, detail: `${n} px, ${ia.width}×${ia.height}` })
}

rows.sort((x, y) => y.pct - x.pct || x.name.localeCompare(y.name))
const fmt = (p) => (p === Infinity ? '—' : p.toFixed(3).replace('.', ',') + ' %')
const bad = rows.filter((r) => r.status !== 'OK')
const md = [
  '# Rapport de comparaison visuelle',
  '',
  `- A : \`${a}\``,
  `- B : \`${b}\``,
  `- Paires comparées : ${rows.length} — OK : ${rows.length - bad.length}, ÉCART : ${bad.filter((r) => r.status === 'ÉCART').length}, TAILLE DIFFÉRENTE : ${bad.filter((r) => r.status !== 'ÉCART').length}`,
  `- Seulement dans A : ${onlyA.length} — seulement dans B : ${onlyB.length}`,
  `- Seuil : OK ≤ ${String(OK).replace('.', ',')} % de pixels différents (pixelmatch threshold 0,1)`,
  '',
  '| Écran | Statut | Différence | Détail |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.name} | ${r.status} | ${fmt(r.pct)} | ${r.detail} |`),
  '',
  ...(onlyA.length ? ['## Captures présentes seulement dans A', '', ...onlyA.map((f) => `- ${f}`), ''] : []),
  ...(onlyB.length ? ['## Captures présentes seulement dans B', '', ...onlyB.map((f) => `- ${f}`), ''] : []),
].join('\n')
writeFileSync(join(out, 'report.md'), md)

console.log(`${rows.length} paires — ${bad.length} écart(s) ; seulement A : ${onlyA.length}, seulement B : ${onlyB.length} → ${join(out, 'report.md')}`)
for (const r of bad.slice(0, 10)) console.log(`  ${r.status.padEnd(17)} ${fmt(r.pct).padStart(10)}  ${r.name}`)
process.exit(bad.length || onlyA.length || onlyB.length ? 1 : 0)
