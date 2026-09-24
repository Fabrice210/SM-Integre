import type { ReactNode } from 'react'
import { create } from 'zustand'

export type ModalSlot = 'modal' | 'modal2'

export interface ModalSpec {
  title: ReactNode
  /** Libellé accessible (l'original utilise le titre texte). */
  label?: string
  sub?: ReactNode
  body: ReactNode
  foot?: ReactNode
  wide?: boolean
}

export interface DrawerSpec {
  title: ReactNode
  label?: string
  sub?: ReactNode
  body: ReactNode
  foot?: ReactNode
}

export interface Toast {
  id: number
  msg: string
  type: 'ok' | 'warn'
}

interface OverlayState {
  modals: Record<ModalSlot, ModalSpec | null>
  drawer: DrawerSpec | null
  toasts: Toast[]
}

/**
 * Couches superposées (modales, tiroir, toasts). Le contenu est un nœud React :
 * y passer un composant qui lit le store (ex. <RiskDetail id="R01" />) pour qu'il
 * se mette à jour après une action, comme le re-rendu de l'original.
 */
export const useOverlays = create<OverlayState>(() => ({
  modals: { modal: null, modal2: null },
  drawer: null,
  toasts: [],
}))

/** modal({...}) de l'original. */
export function openModal(spec: ModalSpec, slot: ModalSlot = 'modal') {
  useOverlays.setState((s) => ({ modals: { ...s.modals, [slot]: spec } }))
}

/** closeModal(id) de l'original ('drawer' ferme le tiroir). */
export function closeModal(slot: ModalSlot | 'drawer' = 'modal') {
  if (slot === 'drawer') useOverlays.setState({ drawer: null })
  else useOverlays.setState((s) => ({ modals: { ...s.modals, [slot]: null } }))
}

/** drawer({...}) de l'original. */
export function openDrawer(spec: DrawerSpec) {
  useOverlays.setState({ drawer: spec })
}

let toastSeq = 0
/** toast(msg, type) de l'original : 3 au maximum, disparition après 3,8 s. */
export function toast(msg: string, type: 'ok' | 'warn' = 'ok') {
  const id = ++toastSeq
  useOverlays.setState((s) => ({ toasts: [...s.toasts, { id, msg, type }].slice(-3) }))
  setTimeout(() => useOverlays.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800)
}
