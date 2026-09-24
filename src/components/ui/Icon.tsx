import { IC, type IconName } from './icons'

interface IconProps {
  /** Nom d'une icône du jeu IC… */
  name?: IconName
  /** …ou tracé SVG brut (comme I(path) dans l'original). */
  path?: string
  size?: number
  className?: string
}

/** I(p, s) de l'original. Les tracés sont des constantes internes (pas de saisie utilisateur). */
export function Icon({ name, path, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path ?? (name ? IC[name] : '') }}
    />
  )
}
