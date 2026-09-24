import type { ComponentType } from 'react'
import { PAGE_TITLES } from './pageTitles'

/** Registre des pages (PAGES de l'original) : chaque module y inscrit ses écrans. */
export const PAGES: Record<string, ComponentType> = {}

export function registerPages(defs: Record<string, ComponentType>) {
  Object.assign(PAGES, defs)
}

/** Une page existe si l'original la définit (même si son écran n'est pas encore migré). */
export const pageExists = (id: string) => id in PAGE_TITLES
export const pageTitle = (id: string) => PAGE_TITLES[id] ?? ''
