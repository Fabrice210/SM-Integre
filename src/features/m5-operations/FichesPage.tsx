/** 5.4 Fiche de maîtrise opérationnelle (original l.1610-1613, 1695). */
import { Fragment } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { openDetail } from '../../components/data/Detail'
import { DueDate } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { FormDef } from '../../forms/types'
import { TODAY, fd, iso } from '../../lib/dates'
import { procName, procOpts, riskOpts, userNames } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, toast } from '../../store/useOverlays'
import { DB, type Any } from '../m6-performance/shared'

export const fichesForms: Record<string, FormDef> = {
  fichesMaitrise: {
    title: 'Fiche de maîtrise opérationnelle',
    prefix: 'FM',
    label: 'objet',
    mod: 'Maîtrise opérationnelle',
    fields: [
      { k: 'objet', l: 'Processus ou activité à risque', req: 1, full: 1 },
      { k: 'processus', l: 'Processus lié (Module 1)', t: 'select', o: procOpts },
      { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
      { k: 'criteres', l: 'Critères opérationnels', t: 'textarea', req: 1 },
      { k: 'moyens', l: 'Moyens de maîtrise', t: 'textarea', req: 1 },
      { k: 'ressources', l: 'Ressources associées', req: 1, full: 1 },
      { k: 'risques', l: 'Risques identifiés (Module 3)', t: 'multi', o: riskOpts, req: 1 },
      { k: 'derniereMaj', l: 'Dernière mise à jour', t: 'date', req: 1 },
      { k: 'prochaineMaj', l: 'Prochaine mise à jour', t: 'date', req: 1 },
    ],
    def: () => ({
      objet: "Pasteurisation du jus d'ananas",
      processus: 'P05',
      responsable: 'Serge KOUTON',
      criteres: 'Température ≥ 85 °C pendant 30 s, enregistrement automatique',
      moyens: 'Thermographe étalonné, contrôle visuel du diagramme par lot',
      ressources: 'Pasteurisateur, thermographe, opérateur formé',
      risques: ['R02'],
      derniereMaj: iso(TODAY),
      prochaineMaj: '2027-09-21',
    }),
  },
}

/** fmUpdate(id) de l'original. */
export function fmUpdate(id: string) {
  update((s) => {
    const f = DB(s).fichesMaitrise.find((x: Any) => x.id === id)
    f.derniereMaj = iso(TODAY)
    const d = new Date(TODAY)
    d.setFullYear(d.getFullYear() + 1)
    f.prochaineMaj = iso(d)
    hist(s, f, 'Mise à jour périodique réalisée')
    logAct(s, 'a mis à jour la fiche de maîtrise « ' + f.objet + ' »', 'Maîtrise opérationnelle')
  })
  toast('Fiche mise à jour — prochaine échéance dans 12 mois.')
  closeModal('drawer')
}

/** fmDetail(i) de l'original. */
export function fmDetail(i: string) {
  const db = DB(useApp.getState())
  const f = db.fichesMaitrise.find((x: Any) => x.id === i)
  if (!f) return
  openDetail({
    coll: 'fichesMaitrise',
    id: i,
    title: f.objet,
    sub: procName(f.processus),
    rows: [
      ['Critères opérationnels', f.criteres],
      ['Moyens de maîtrise', f.moyens],
      ['Responsable', f.responsable],
      ['Ressources', f.ressources],
      [
        'Risques liés',
        f.risques.map((r: string, j: number) => (
          <Fragment key={r + j}>
            {j > 0 ? <br /> : null}
            {r + ' · ' + ((db.risques.find((x: Any) => x.id === r) || {}).intitule || '')}
          </Fragment>
        )),
      ],
      ['Dernière mise à jour', fd(f.derniereMaj)],
      ['Prochaine mise à jour', <DueDate key="pm" date={f.prochaineMaj} />],
    ],
    obs: true,
    acts: (
      <button className="btn" onClick={() => fmUpdate(i)}>
        Marquer comme mise à jour
      </button>
    ),
  })
}

export function FichesPage() {
  const db = useApp((s) => s.db) as Any
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m5}
        title="5.4 Fiche de maîtrise opérationnelle"
        desc="Une fiche par processus ou activité à risque, liée au processus et aux risques, avec alerte avant l'échéance de mise à jour."
      />
      <div className="card">
        <DataTable
          id="fm"
          cols={[
            {
              l: 'Activité à risque',
              r: (f) => (
                <>
                  <span className="ttl">{f.objet}</span>
                  <br />
                  <span className="ref">{procName(f.processus)}</span>
                </>
              ),
            },
            { l: 'Critères opérationnels', r: (f) => <span className="small">{f.criteres}</span> },
            { l: 'Moyens de maîtrise', r: (f) => <span className="small">{f.moyens}</span> },
            { l: 'Responsable', k: 'responsable' },
            {
              l: 'Risques',
              r: (f) =>
                f.risques.map((r: string, j: number) => (
                  <Fragment key={r + j}>
                    {j > 0 ? ' ' : null}
                    <span className="badge b-grey">{r}</span>
                  </Fragment>
                )),
            },
            { l: 'Prochaine mise à jour', r: (f) => <DueDate date={f.prochaineMaj} /> },
          ]}
          rows={db.fichesMaitrise as Any[]}
          onRowClick={fmDetail}
          search={['objet', 'criteres']}
          filters={[{ k: 'processus', l: 'Processus', o: procOpts }]}
          onAdd={() => openForm('fichesMaitrise')}
          addLabel="Créer une fiche"
          exportName="Fiches_maitrise_operationnelle"
          norm={false}
        />
      </div>
    </>
  )
}
