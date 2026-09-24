/** Option de liste : valeur seule ou couple [valeur, libellé] (forme de l'original). */
export type Opt = string | number | readonly [string | number, string]
export type Opts = readonly Opt[] | (() => readonly Opt[])

/** optList(o) de l'original, normalisé en couples [valeur, libellé]. */
export function optList(o: Opts | undefined): [string, string][] {
  const list = (typeof o === 'function' ? o() : o) || []
  return list.map((x) => (Array.isArray(x) ? [String(x[0]), String(x[1])] : [String(x), String(x)]))
}
