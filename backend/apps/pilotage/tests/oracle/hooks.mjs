// Hooks de l'oracle : imports sans extension résolus vers .ts, modules d'interface remplacés par des stubs.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const STUBS = {
  'store/useApp': `export const useApp = { getState: () => ({}) }; export const logAct = () => {}; export const update = () => {}; export const currentUser = () => ({}); export const hist = () => {}; export const nextId = () => 'X';`,
  'store/useOverlays': `export const toast = () => {}; export const openModal = () => {}; export const closeModal = () => {};`,
  'services/exports': `export const download = () => {}; export const printDoc = () => {};`,
  'm6-performance/nc': `export const NC_CAT = ['Non-conformité', 'Accident / incident', "Piste d'amélioration", 'Observation'];`,
}

export async function resolve(specifier, context, next) {
  for (const [k, src] of Object.entries(STUBS)) {
    if (specifier.endsWith(k)) {
      return { url: 'data:text/javascript,' + encodeURIComponent(src), shortCircuit: true }
    }
  }
  if (specifier.startsWith('.') && context.parentURL && !path.extname(specifier)) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    for (const ext of ['.ts', '.tsx']) {
      if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
