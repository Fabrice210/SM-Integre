/** 5.1 Gestion électronique des documents (original l.1558-1563, 1582-1588). */
import { DataTable } from '../../components/data/DataTable'
import { DueDate, NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL, NORMS } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { FORMS } from '../../forms/registry'
import type { FormDef } from '../../forms/types'
import { TODAY, days, iso } from '../../lib/dates'
import { procOpts, userNames } from '../../lib/lookups'
import { currentUser, useApp } from '../../store/useApp'
import { DB, type Any } from '../m6-performance/shared'
import { docDetail } from './gedDetail'

export const DOC_TYPES = [
  'Procédure',
  'Instruction',
  'Formulaire',
  'Enregistrement',
  'Politique',
  'Manuel',
  'Document externe',
]
export const DOC_ST = ['Rédaction', 'Vérification', 'Approbation', 'Diffusé', 'Refusé', 'Obsolète']

export const gedForms: Record<string, FormDef> = {
  documents: {
    title: 'Fiche documentaire',
    prefix: 'D',
    label: 'intitule',
    mod: 'GED',
    wide: true,
    fields: (_r, n) => [
      { k: 'ref', l: 'Référence', req: 1 },
      { k: 'intitule', l: 'Intitulé', req: 1 },
      { k: 'type', l: 'Type', t: 'select', o: DOC_TYPES },
      { k: 'proprietaire', l: 'Propriétaire', t: 'select', o: userNames },
      { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
      { k: 'dateRevue', l: 'Date de prochaine revue', t: 'date', req: 1 },
      { k: 'normes', l: 'Normes applicables', t: 'norms', req: 1 },
      { k: 'droits', l: "Droits d'accès (lecture, modification, validation)", req: 1, full: 1 },
      { k: 'diffusion', l: 'Liste de diffusion', req: 1, full: 1 },
      ...(n
        ? [
            {
              k: 'modele',
              l: 'Modèle utilisé',
              t: 'select',
              o: () => DB(useApp.getState()).modeles.map((m: Any) => m.nom),
            },
            { k: 'contenu', l: 'Contenu de la version 1', t: 'textarea', req: 1 },
          ]
        : []),
    ],
    def: () => ({
      ref: 'PR-HSE-08',
      intitule: 'Gestion des déchets de production',
      type: 'Procédure',
      proprietaire: 'Arnaud TCHIBOZO',
      processus: 'P11',
      dateRevue: '2027-09-30',
      normes: ['14001'],
      droits: 'Lecture : tous ; Modification : HSE ; Validation : Direction Industrielle',
      diffusion: 'Direction Industrielle, Direction QSE-SI, EcoCollecte Bénin',
      modele: 'Modèle de procédure',
      contenu:
        'Trier les déchets à la source dans les bacs identifiés.\nPeser et enregistrer chaque enlèvement.\nConserver les bordereaux de suivi pendant 5 ans.',
      version: '1',
      statut: 'Rédaction',
      dateCreation: iso(TODAY),
    }),
    save: (s, r, n) => {
      if (n) {
        r.versions = [{ v: '1', date: iso(TODAY), auteur: currentUser(s).nom, contenu: r.contenu }]
        delete r.contenu
        return "Document créé à l'étape Rédaction."
      }
    },
  },
  modeles: {
    title: 'Modèle de document',
    prefix: 'MD',
    label: 'nom',
    mod: 'GED',
    fields: [
      { k: 'nom', l: 'Nom du modèle', req: 1 },
      { k: 'type', l: 'Type', t: 'select', o: DOC_TYPES },
      { k: 'description', l: 'Structure du modèle', t: 'textarea', req: 1 },
      { k: 'fichier', l: 'Fichier du modèle', t: 'file', req: 1 },
    ],
    def: () => ({
      nom: 'Modèle de fiche de données de sécurité',
      type: 'Enregistrement',
      description: 'Produit, dangers, EPI, premiers secours, stockage',
      fichier: 'Modele_FDS.docx',
    }),
  },
}

/** Bouton « Utiliser » : ouvre la fiche documentaire préremplie avec le modèle. */
function utiliserModele(m: Any) {
  const o = FORMS.documents.def
  FORMS.documents.def = (s) => ({ ...o(s), modele: m.nom, type: m.type })
  openForm('documents')
  FORMS.documents.def = o
}

export function GedPage() {
  const db = useApp((s) => s.db) as Any
  const activeNorms = useApp((s) => s.activeNorms)
  const [t, tb] = useTabs('ged', [
    ['doc', 'Documents'],
    ['mod', 'Bibliothèque de modèles'],
    ['arc', 'Archives'],
  ])
  const D: Any[] = db.documents
  let c = null
  if (t === 'doc')
    c = (
      <DataTable
        id="docs"
        cols={[
          { l: 'Référence', r: (d) => <span className="ttl">{d.ref}</span> },
          {
            l: 'Intitulé',
            r: (d) => (
              <>
                {d.intitule}
                <br />
                <span className="ref">{d.proprietaire}</span>
              </>
            ),
          },
          { l: 'Type', k: 'type' },
          { l: 'Version', r: (d) => 'v' + d.versions.at(-1).v },
          { l: 'Processus', r: (d) => <span className="badge b-grey">{d.processus}</span> },
          { l: 'Statut', r: (d) => <StatusBadge value={d.statut} /> },
          { l: 'Prochaine revue', r: (d) => <DueDate date={d.dateRevue} /> },
          { l: 'Normes', r: (d) => <NormBadges norms={d.normes} /> },
        ]}
        rows={D.filter((d) => d.statut !== 'Obsolète')}
        onRowClick={docDetail}
        search={['ref', 'intitule', 'proprietaire']}
        filters={[
          { k: 'type', l: 'Type', o: DOC_TYPES },
          { k: 'processus', l: 'Processus', o: procOpts },
          {
            k: 'normes',
            l: 'Norme',
            o: () => activeNorms.map((n) => [n, NORMS[n].code] as [string, string]),
          },
          { k: 'statut', l: 'Statut', o: DOC_ST },
        ]}
        onAdd={() => openForm('documents')}
        addLabel="Créer une fiche documentaire"
        exportName="Liste_des_documents"
      />
    )
  if (t === 'mod')
    c = (
      <>
        <div className="grid g4 mb">
          {db.modeles.map((m: Any) => (
            <div key={m.id} className="card flat">
              <div className="stat-ic">
                <Icon name="doc" size={18} />
              </div>
              <h3 style={{ fontSize: 14, margin: '10px 0 4px' }}>{m.nom}</h3>
              <div className="small muted">
                {m.type} — {m.description}
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={() => utiliserModele(m)}>
                  Utiliser
                </button>
                <button className="btn sm ghost" onClick={() => openForm('modeles', m.id)}>
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn sm" onClick={() => openForm('modeles')}>
          <Icon name="plus" size={14} /> Charger un modèle
        </button>
      </>
    )
  if (t === 'arc')
    c = (
      <>
        <div className="note mb">
          Les documents obsolètes sont archivés automatiquement et restent consultables pour la
          traçabilité.
        </div>
        <DataTable
          id="arc"
          cols={[
            { l: 'Référence', k: 'ref' },
            { l: 'Intitulé', k: 'intitule' },
            { l: 'Dernière version', r: (d) => 'v' + d.versions.at(-1).v },
            { l: 'Archivé', r: () => <StatusBadge value="Obsolète" /> },
          ]}
          rows={D.filter((d) => d.statut === 'Obsolète')}
          onRowClick={docDetail}
          exportName="Archives_documentaires"
        />
      </>
    )
  const pend = D.filter((d) => ['Vérification', 'Approbation'].includes(d.statut)).length
  const stats: [string, number][] = [
    ['Documents en vigueur', D.filter((d) => d.statut === 'Diffusé').length],
    ['En circuit de validation', pend],
    ['En rédaction', D.filter((d) => d.statut === 'Rédaction').length],
    [
      'Revues sous 30 jours',
      D.filter((d) => d.statut !== 'Obsolète' && (days(d.dateRevue) as number) <= 30).length,
    ],
  ]
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m5}
        title="5.1 Gestion électronique des documents"
        desc="Fiches documentaires, workflow rédaction → vérification → approbation, versions comparables, diffusion contrôlée et archivage."
      />
      <div className="grid g4 mb">
        {stats.map(([a, b]) => (
          <div key={a} className="card">
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>
      {tb}
      <div className="card">{c}</div>
    </>
  )
}
