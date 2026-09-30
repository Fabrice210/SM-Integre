/** 6.4 Non-conformités — formulaire, déclaration, circuit à deux niveaux et fiche (original l.1667-1681). */
import type { ReactNode } from 'react'
import { openDetail } from '../../components/data/Detail'
import { NormBadges, StatusBadge, Workflow } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { openForm } from '../../forms/crud'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import { FORMS } from '../../forms/registry'
import type { FieldDef, FormDef, Rec } from '../../forms/types'
import { TODAY, fd, iso } from '../../lib/dates'
import { procName, procOpts } from '../../lib/lookups'
import { procOwner } from '../../services/metrics'
import { currentUser, hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { addRegistre } from '../../services/registre'
import { act, seg } from '../../services/session'
import { DB, type Any } from './shared'

export const NC_CAT = [
  'Non-conformité',
  'Accident / incident',
  "Piste d'amélioration",
  'Observation',
]

/** ncFields(r) de l'original. */
function ncFields(r: Rec): FieldDef[] {
  const acc = r.categorie === 'Accident / incident'
  const base: FieldDef[] = [
    { k: 'categorie', l: 'Catégorie', t: 'select', o: NC_CAT },
    { k: 'source', l: 'Source', t: 'select', o: () => DB(useApp.getState()).sourcesNC },
    { k: 'description', l: 'Description', t: 'textarea', req: 1 },
    {
      k: 'typeActe',
      l: "Type d'acte",
      t: 'select',
      o: ['Conformité', 'Dysfonctionnement'],
      h: 'Conformité : cause + action ; dysfonctionnement : écart de fonctionnement',
    },
    { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
    { k: 'lieu', l: 'Lieu', req: 1 },
    { k: 'date', l: 'Date', t: 'date', req: 1 },
    { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    {
      k: 'cause',
      l: acc ? 'Cause' : 'Cause (analyse 5 Pourquoi / Ishikawa)',
      t: 'textarea',
      req: 1,
    },
    {
      k: 'action',
      l: acc
        ? 'Acte / décision'
        : r.categorie === "Piste d'amélioration" || r.categorie === 'Observation'
          ? "Plan d'action généré"
          : 'Action corrective',
      t: 'textarea',
      req: 1,
    },
  ]
  if (acc) base.push({ k: 'miseEnOeuvre', l: 'Mise en œuvre', t: 'textarea', req: 1 })
  return base
}

export const ncForms: Record<string, FormDef> = {
  ncs: {
    title: 'Déclaration',
    prefix: 'NC',
    label: 'description',
    mod: 'Non-conformités',
    wide: true,
    fields: (r) => ncFields(r),
    def: (s) => ({
      categorie: 'Non-conformité',
      source: 'Terrain',
      description: 'Palettes de noix stockées directement au sol dans la zone B',
      typeActe: 'Conformité',
      processus: 'P04',
      lieu: 'Magasin matières premières — zone B',
      date: iso(TODAY),
      normes: ['9001'],
      cause: 'Manque de palettes après la livraison du 18/09',
      action: 'Commander 150 palettes et rappeler la consigne au magasinier',
      statut: 'Déclarée',
      n1: 'En attente',
      n2: 'En attente',
      declarant: currentUser(s).nom,
      origine: 'Terrain',
    }),
    save: (s, r, n) => {
      if (n) {
        const pre = (
          {
            'Non-conformité': 'NC',
            'Accident / incident': 'INC',
            "Piste d'amélioration": 'AM',
            Observation: 'OBS',
          } as Record<string, string>
        )[r.categorie]
        r.ref = pre + '-2026-0' + (25 + DB(s).ncs.length)
        return (
          r.ref +
          ' déclaré(e) — le pilote du processus est notifié pour validation.' +
          (r.categorie === "Piste d'amélioration" ? " Plan d'action généré." : '')
        )
      }
    },
  },
}

/** declareNC(cat) de l'original. */
export function declareNC(cat: string) {
  const old = FORMS.ncs.def
  const ex = (
    {
      'Accident / incident': {
        categorie: cat,
        source: 'Incident',
        description:
          "Chute d'un magasinier depuis un quai de chargement (entorse, 2 jours d'arrêt)",
        typeActe: 'Dysfonctionnement',
        processus: 'P07',
        lieu: 'Quai n°3 — entrepôt de Porto-Novo',
        normes: ['45001'],
        cause: 'Quai humide, absence de garde-corps',
        action: 'Installer un garde-corps amovible et un revêtement antidérapant',
        miseEnOeuvre: 'Garde-corps commandé le jour même, balisage provisoire posé',
        statut: 'Déclarée',
      },
      "Piste d'amélioration": {
        categorie: cat,
        source: 'Boîte à idées',
        description: 'Digitaliser la check-list de prise de poste sur tablette',
        typeActe: 'Dysfonctionnement',
        processus: 'P05',
        lieu: 'Atelier décorticage',
        normes: ['45001', '9001'],
        cause: 'Check-lists papier souvent incomplètes',
        action: 'Tester une tablette sur la ligne 1 pendant un mois',
        statut: 'Déclarée',
      },
    } as Record<string, Rec>
  )[cat]
  FORMS.ncs.def = (s) => ({ ...old(s), ...(ex || {}) })
  openForm('ncs')
  FORMS.ncs.def = old
}

/** addSource() de l'original. */
export function addSource() {
  openModal({
    title: 'Enrichir la liste des sources',
    body: (
      <>
        <div id="srcf">
          <FormRenderer
            formId="srcf"
            fields={[{ k: 's', l: 'Nouvelle source', req: 1 }]}
            rec={{ s: "Inspection de l'ABE" }}
          />
        </div>
        <p className="small muted">
          Sources actuelles : {DB(useApp.getState()).sourcesNC.join(', ')}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const d = readForm('srcf')
            if (!d) return
            update((s) => {
              DB(s).sourcesNC.push(d.s)
              logAct(s, 'a ajouté la source « ' + d.s + ' »', 'Non-conformités')
            })
            closeModal()
            toast('Source ajoutée.')
          }}
        >
          Ajouter
        </button>
      </>
    ),
  })
}

/** ncAct(id, a) de l'original. */
export function ncAct(id: string, a: 'v1' | 'v2' | 'ko' | 'close') {
  let e: string | null = null
  if (a === 'close') {
    e = prompt(
      "Évaluation de l'efficacité avant clôture :",
      'Efficace — aucune récidive constatée sur 30 jours'
    )
    if (e === null) return
  }
  let m = ''
  let ref = ''
  const local = () =>
    update((s) => {
      const n = DB(s).ncs.find((x: Any) => x.id === id)
      if (a === 'v1') {
        n.n1 = 'Validé'
        n.statut = 'Validée pilote'
        m = 'validé(e) par le pilote — transmis(e) au responsable du système'
      }
      if (a === 'v2') {
        n.n2 = 'Approuvé'
        n.statut = 'En traitement'
        addRegistre(
          s,
          n.categorie === 'Accident / incident' ? 'Incident' : n.categorie,
          n.description,
          n.source + ' (' + n.ref + ')',
          n.processus,
          n.normes,
          procOwner(s.db, n.processus)
        )
        m = 'approuvé(e) par le responsable du système — consolidé(e) dans le registre'
      }
      if (a === 'ko') {
        n.statut = 'Refusée'
        n.n1 = n.n1 === 'Validé' ? 'Validé' : 'Refusé'
        if (n.n1 === 'Validé') n.n2 = 'Refusé'
        m = 'refusé(e) — retour au déclarant'
      }
      if (a === 'close') {
        n.statut = 'Clôturée'
        n.efficacite = e
        const g = DB(s).registre.find((x: Any) => x.origine.includes(n.ref))
        if (g) g.statut = 'Clôturé'
        m = 'clôturé(e) — efficacité : ' + e
      }
      ref = n.ref
      hist(s, n, n.ref + ' ' + m)
      logAct(s, 'a ' + m.split(' ')[0] + ' ' + n.ref, 'Non-conformités', n.statut)
    })
  const route = { v1: 'valider-pilote', v2: 'approuver', ko: 'refuser', close: 'cloturer' }[a]
  const body = a === 'close' ? { efficacite: e } : undefined
  act<Any>(`/ncs/${seg(id)}/${route}/`, body, local, (r) => {
    toast(r ? `${r.ref} : statut « ${r.statut} ».` : ref + ' ' + m + '.')
    ncDetail(id)
  })
}

/** ncDetail(id) de l'original. */
export function ncDetail(id: string) {
  const n = DB(useApp.getState()).ncs.find((x: Any) => x.id === id)
  if (!n) return
  const idx = (
    { Déclarée: 1, 'Validée pilote': 2, 'En traitement': 3, Clôturée: 5, Refusée: 1 } as Record<
      string,
      number
    >
  )[n.statut]
  const acts: ReactNode =
    n.statut === 'Déclarée' ? (
      <>
        <button className="btn danger" onClick={() => ncAct(id, 'ko')}>
          Refuser
        </button>
        <button className="btn primary" onClick={() => ncAct(id, 'v1')}>
          <Icon name="check" size={15} /> Valider (pilote)
        </button>
      </>
    ) : n.statut === 'Validée pilote' ? (
      <>
        <button className="btn danger" onClick={() => ncAct(id, 'ko')}>
          Refuser
        </button>
        <button className="btn primary" onClick={() => ncAct(id, 'v2')}>
          <Icon name="check" size={15} /> Approuver (responsable du système)
        </button>
      </>
    ) : n.statut === 'En traitement' ? (
      <button className="btn primary" onClick={() => ncAct(id, 'close')}>
        Évaluer l'efficacité et clôturer
      </button>
    ) : null
  const rows: [string, ReactNode][] = [
    [
      'Circuit',
      <Workflow
        key="wf"
        steps={['Déclaration', 'Validation pilote', 'Approbation RSM', 'Traitement', 'Clôture']}
        current={idx}
        ko={n.statut === 'Refusée'}
      />,
    ],
    ['Statut', <StatusBadge key="st" value={n.statut} />],
    ['Validation niveau 1 (pilote)', <StatusBadge key="n1" value={n.n1} />],
    ['Validation niveau 2 (responsable)', <StatusBadge key="n2" value={n.n2} />],
    ['Source', n.source + ' — ' + n.origine],
    ['Description', n.description],
    ["Type d'acte", n.typeActe],
    ['Cause', n.cause],
    [n.categorie === 'Accident / incident' ? 'Acte / décision' : "Plan d'action", n.action],
    ...(n.miseEnOeuvre ? ([['Mise en œuvre', n.miseEnOeuvre]] as [string, ReactNode][]) : []),
    ['Lieu', n.lieu],
    ['Processus', procName(n.processus)],
    ['Normes', <NormBadges key="nb" norms={n.normes} />],
    ...(n.efficacite ? ([['Efficacité', n.efficacite]] as [string, ReactNode][]) : []),
  ]
  openDetail({
    coll: 'ncs',
    id,
    title: n.ref + ' · ' + n.categorie,
    sub: 'Déclarée le ' + fd(n.date) + ' par ' + n.declarant,
    rows,
    edit: ['Déclarée', 'Refusée'].includes(n.statut),
    acts,
  })
}
