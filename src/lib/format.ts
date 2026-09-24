export function money(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('fr-FR') + ' FCFA'
}

export function initials(n: string): string {
  return String(n)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()
}
