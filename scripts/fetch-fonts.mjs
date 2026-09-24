/**
 * Rapatrie Plus Jakarta Sans en local (reference/fonts + src/assets/fonts)
 * et fait pointer l'original figé dessus : les captures de référence ne
 * dépendent plus du réseau.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const GF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const DIRS = ['reference/fonts', 'src/assets/fonts']
DIRS.forEach((d) => mkdirSync(d, { recursive: true }))

const css = await fetch(GF, { headers: { 'User-Agent': UA } }).then((r) => r.text())
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))]
let local = css
for (const url of urls) {
  const name = url.split('/').pop()
  const buf = Buffer.from(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()))
  DIRS.forEach((d) => writeFileSync(join(d, name), buf))
  local = local.split(url).join(`./${name}`)
}
DIRS.forEach((d) => writeFileSync(join(d, 'plus-jakarta-sans.css'), local))

const htmlPath = 'reference/original.html'
let html = readFileSync(htmlPath, 'utf8')
html = html
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"><link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/, '<link href="fonts/plus-jakarta-sans.css" rel="stylesheet">')
writeFileSync(htmlPath, html)
console.log(`${urls.length} fichiers de police ; références Google Fonts restantes : ${(html.match(/fonts\.g(oogleapis|static)\.com/g) || []).length}`)
