import { NORMS } from '../../data/referentiels'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef } from '../../forms/types'
import { fd, iso, TODAY } from '../../lib/dates'
import { axeName } from '../../lib/lookups'
import { printDoc } from '../../services/exports'
import { currentUser, hist, logAct, nextId, update, useApp } from '../../store/useApp'
import type { AppState } from '../../store/types'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { esc, type Any } from './util'

const AXE_BY_NORM: Record<string, string> = {
  '27001': 'AX4',
  '45001': 'AX2',
  '14001': 'AX3',
  '9001': 'AX1',
}

/** genEnjeux() : un enjeu par facteur PESTEL sans enjeu, rattaché aux axes. */
export function genEnjeux() {
  let n = 0
  update((s) => {
    s.db.pestel.forEach((f) => {
      if (s.db.enjeux.some((e) => e.origine === f.id)) return
      const axe = [...new Set(f.normes.map((x) => AXE_BY_NORM[x]))]
      const e: Any = {
        id: nextId(s, 'EN'),
        libelle:
          (f.qualification === 'Positif' ? 'Saisir : ' : 'Maîtriser : ') +
          f.facteur.charAt(0).toLowerCase() +
          f.facteur.slice(1),
        source: 'Externe (PESTEL)',
        qualification: f.qualification,
        axes: axe,
        normes: f.normes.slice(),
        origine: f.id,
        date: iso(TODAY),
        statut: 'Actif',
      }
      hist(s, e, 'Généré automatiquement depuis le facteur ' + f.id)
      s.db.enjeux.unshift(e)
      n++
    })
    logAct(s, `a généré ${n} enjeu(x) depuis la matrice PESTEL`, 'Enjeux')
    s.ui.tabs.enjeux = 'enj'
  })
  toast(
    n
      ? `${n} enjeu(x) généré(s) et associé(s) aux axes de la politique.`
      : 'Tous les facteurs externes ont déjà un enjeu.'
  )
}

const VF_FIELDS: FieldDef[] = [
  { k: 'commentaire', l: 'Commentaire de version', t: 'textarea', req: 1 },
]

/** saveVersion(coll, label) : fige une nouvelle version de l'analyse ou du domaine. */
export function saveVersion(coll: 'analyseVersions' | 'domaineVersions', label: string) {
  const L = useApp.getState().db[coll]
  const v =
    'v' +
    (parseFloat(L[L.length - 1].version.slice(1)) + 1).toFixed(coll === 'analyseVersions' ? 1 : 0)
  const onSave = () => {
    const d = readForm('vf')
    if (d) {
      update((s) => {
        ;(s.db[coll] as Any[]).push({
          id: nextId(s, 'V'),
          version: v,
          date: iso(TODAY),
          auteur: currentUser(s).nom,
          commentaire: d.commentaire,
          facteurs: s.db.swot.length + s.db.pestel.length,
          enjeux: s.db.enjeux.length,
        })
        logAct(s, `a enregistré la version ${v} (${label})`, label)
      })
      closeModal()
      toast(`Version ${v} enregistrée.`)
    }
  }
  openModal({
    title: 'Enregistrer une nouvelle version',
    body: (
      <div id="vf">
        <FormRenderer
          formId="vf"
          fields={VF_FIELDS}
          rec={{
            commentaire:
              'Mise à jour après la revue de direction et la veille du 3e trimestre 2026',
          }}
        />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={onSave}>
          Enregistrer {v}
        </button>
      </>
    ),
  })
}

/** exportAnalyse() : PDF des grilles SWOT / PESTEL et des enjeux. */
export function exportAnalyse() {
  const DB = useApp.getState().db
  printDoc(
    'Analyse SWOT / PESTEL et enjeux',
    `<h2>Facteurs internes (SWOT)</h2><table><tr><th>Type</th><th>Facteur</th><th>Description</th><th>Impact</th></tr>${DB.swot.map((s) => `<tr><td>${s.type}</td><td>${esc(s.libelle)}</td><td>${esc(s.description)}</td><td>${s.impact}/5</td></tr>`).join('')}</table><h2>Facteurs externes (PESTEL)</h2><table><tr><th>Dimension</th><th>Facteur</th><th>Qualification</th><th>Impact</th></tr>${DB.pestel.map((s) => `<tr><td>${s.dimension}</td><td>${esc(s.facteur)}</td><td>${s.qualification}</td><td>${s.impact}/5</td></tr>`).join('')}</table><h2>Enjeux</h2><table><tr><th>Enjeu</th><th>Source</th><th>Axes</th></tr>${DB.enjeux.map((e) => `<tr><td>${esc(e.libelle)}</td><td>${e.source}</td><td>${e.axes.map(axeName).join('<br>')}</td></tr>`).join('')}</table>`
  )
}

/** domaineHTML() : document consolidé du domaine d'application (HTML identique à l'original). */
export function domaineHTML(
  s: Pick<AppState, 'db' | 'org' | 'activeNorms'> = useApp.getState()
): string {
  const DB = s.db
  const ORG = s.org
  const dv = DB.domaineVersions[DB.domaineVersions.length - 1]
  return `<h2>Domaine d'application du système de management intégré</h2><p class="muted">${esc(ORG.nom)} — ${esc(dv.version)} du ${fd(dv.date)} — ${s.activeNorms.map((n) => NORMS[n].code + ':' + NORMS[n].version.slice(0, 4)).join(', ')}</p>
 <h3>1. Organisme</h3><p>${esc(ORG.nom)}, ${esc(ORG.secteur.toLowerCase())}, ${ORG.effectif} salariés, siège : ${esc(ORG.adresse)}.</p>
 <h3>2. Sites inclus</h3><ul>${DB.sites
   .filter((x) => x.statut === 'Inclus')
   .map((x) => `<li><b>${esc(x.nom)}</b> — ${esc(x.adresse)} : ${esc(x.activite)}</li>`)
   .join('')}</ul>
 <h3>3. Activités, produits et services couverts</h3><ul>${DB.activites
   .filter((x) => x.statut === 'Inclus')
   .map((x) => `<li>${esc(x.type)} : ${esc(x.libelle)} (${esc(x.site)})</li>`)
   .join('')}</ul>
 <h3>4. Exclusions justifiées</h3><ul>${([...DB.sites, ...DB.activites] as Any[])
   .filter((x) => x.statut === 'Exclu')
   .map((x) => `<li><b>${esc(x.nom || x.libelle)}</b> — ${esc(x.justification)}</li>`)
   .join('')}</ul>
 <h3>5. Processus du système</h3><p>${DB.processus.map((p) => p.code + ' ' + p.intitule).join(' ; ')}.</p>`
}

/** exportCarto() : PDF de la cartographie des processus. */
export function exportCarto() {
  const DB = useApp.getState().db
  printDoc(
    'Cartographie des processus',
    ['Pilotage', 'Réalisation', 'Support']
      .map(
        (c) =>
          `<h2>Processus de ${c.toLowerCase()}</h2><table><tr><th>Code</th><th>Processus</th><th>Pilote</th><th>Finalité</th><th>Entrées</th><th>Sorties</th><th>Indicateurs</th></tr>${DB.processus
            .filter((p) => p.categorie === c)
            .map(
              (p) =>
                `<tr><td>${p.code}</td><td>${esc(p.intitule)}</td><td>${esc(p.proprietaire)}</td><td>${esc(p.finalite)}</td><td>${esc(p.entrees)}</td><td>${esc(p.sorties)}</td><td>${esc(p.indicateurs)}</td></tr>`
            )
            .join('')}</table>`
      )
      .join('')
  )
}
