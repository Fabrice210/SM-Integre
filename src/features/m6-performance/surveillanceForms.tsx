/** 6.1 Surveillance — formulaires, évaluation des intervenants et mini-graphiques (original l.1616-1621). */
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef, FormDef } from '../../forms/types'
import { procOpts, userNames } from '../../lib/lookups'
import { taux } from '../../services/metrics'
import { act, seg } from '../../services/session'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { DB, type Any } from './shared'

export const surveillanceForms: Record<string, FormDef> = {
  indicateurs: {
    title: 'Indicateur (KPI)',
    prefix: 'KP',
    label: 'kpi',
    mod: 'Surveillance',
    fields: [
      { k: 'kpi', l: 'Indicateur', req: 1, full: 1 },
      {
        k: 'objectif',
        l: 'Objectif rattaché',
        t: 'select',
        o: () => ['—', ...DB(useApp.getState()).objectifs.map((o: Any) => o.code)],
      },
      {
        k: 'sens',
        l: "Sens d'amélioration",
        t: 'select',
        o: [
          ['hausse', 'Plus haut = mieux'],
          ['baisse', 'Plus bas = mieux'],
        ],
      },
      { k: 'cible', l: 'Cible', t: 'number', req: 1 },
      { k: 'unite', l: 'Unité', req: 1 },
      { k: 'valeur', l: 'Dernière valeur mesurée', t: 'number', req: 1 },
      { k: 'moyen', l: 'Moyen de mesure', req: 1 },
      { k: 'echeance', l: 'Échéance', t: 'date', req: 1 },
      { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
      { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
      { k: 'action', l: 'Action associée', req: 1, full: 1 },
    ],
    def: () => ({
      kpi: "Consommation d'eau par tonne produite",
      objectif: '—',
      sens: 'baisse',
      cible: 4.5,
      unite: 'm³/t',
      valeur: 5.2,
      moyen: 'Relevé mensuel des compteurs',
      echeance: '2027-06-30',
      processus: 'P05',
      responsable: 'Serge KOUTON',
      action: 'Installer des compteurs divisionnaires',
    }),
    save: (_s, r) => {
      if (taux(r) < 80)
        return (
          'Indicateur enregistré — écart significatif détecté, alerte envoyée à ' +
          r.responsable +
          '.'
        )
    },
  },
  prestataires: {
    title: 'Intervenant externe',
    prefix: 'EX',
    label: 'nom',
    mod: 'Surveillance',
    fields: [
      { k: 'nom', l: 'Nom', req: 1 },
      { k: 'categorie', l: 'Catégorie', t: 'select', o: ['Critique', 'Classique'] },
      { k: 'debut', l: 'Début de collaboration', t: 'date', req: 1 },
      {
        k: 'frequence',
        l: "Fréquence d'évaluation",
        t: 'select',
        o: ['Trimestrielle', 'Semestrielle', 'Annuelle'],
      },
      { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
      { k: 'responsable', l: "Responsable de l'évaluation", t: 'select', o: userNames },
      { k: 'champ', l: "Champ d'évaluation", t: 'textarea', req: 1 },
    ],
    def: () => ({
      nom: 'SOBEPRAN Emballages',
      categorie: 'Critique',
      debut: '2024-05-01',
      frequence: 'Semestrielle',
      processus: 'P05',
      responsable: 'Aïcha BIO SIKA',
      champ: 'Conformité des sachets sous vide, délais de livraison',
      notes: { qualite: 3, delai: 3, securite: 3, environnement: 3 },
    }),
  },
}

/** pScore(p) de l'original. */
export const pScore = (p: Any) =>
  Math.round(
    ((p.notes.qualite + p.notes.delai + p.notes.securite + p.notes.environnement) / 20) * 100
  )

const EV_F: FieldDef[] = [
  { k: 'qualite', l: 'Qualité (1 à 5)', t: 'scale' },
  { k: 'delai', l: 'Respect des délais (1 à 5)', t: 'scale' },
  { k: 'securite', l: "Sécurité / sécurité de l'information (1 à 5)", t: 'scale' },
  { k: 'environnement', l: 'Environnement (1 à 5)', t: 'scale' },
]

/** evalPresta(id) de l'original. */
export function evalPresta(id: string) {
  const p = DB(useApp.getState()).prestataires.find((x: Any) => x.id === id)
  openModal({
    title: 'Évaluer — ' + p.nom,
    sub: 'Score calculé automatiquement. Sous 60 %, un plan de progrès est requis.',
    body: (
      <div id="evf">
        <FormRenderer formId="evf" fields={EV_F} rec={p.notes} />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const d = readForm('evf')
            // Notes obligatoires (readForm de l'original avec req:1 sur chaque échelle)
            if (!d || EV_F.some((f) => d[f.k] == null)) return
            let sc = 0
            const local = () =>
              update((s) => {
                const p = DB(s).prestataires.find((x: Any) => x.id === id)
                p.notes = d
                sc = pScore(p)
                hist(s, p, 'Évaluation : ' + sc + ' %')
                logAct(s, 'a évalué ' + p.nom + ' (' + sc + ' %)', 'Surveillance')
              })
            act<Any>(`/prestataires/${seg(id)}/evaluer/`, d, local, (r) => {
              if (r) sc = pScore(r)
              closeModal()
              toast('Score : ' + sc + ' %' + (sc < 60 ? ' — plan de progrès requis.' : '.'))
            })
          }}
        >
          Enregistrer l'évaluation
        </button>
      </>
    ),
  })
}

/** miniBars(vals, labels, color, unit) de l'original. */
export function MiniBars({
  vals,
  labels,
  color,
  unit = '',
}: {
  vals: number[]
  labels: string[]
  color: string
  unit?: string
}) {
  const m = Math.max(...vals) * 1.15
  return (
    <div className="bars" style={{ height: 150, paddingLeft: 4 }}>
      {vals.map((v, i) => (
        <div key={i} className="bar on" style={{ cursor: 'default' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {String(v).replace('.', ',')}
            {unit}
          </span>
          <i style={{ height: (v / m) * 110 + 'px', background: color }}></i>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}
