import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, Progress } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { NORMS, type NormId } from '../../data/referentiels'
import type { Seed } from '../../data/seed'
import { printDoc } from '../../services/exports'
import { useApp } from '../../store/useApp'
import { coverage } from '../../services/metrics'

type MappingRow = Seed['mapping'][number] & { normes: string[] }

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

/** auditFile() de l'original : dossier d'audit imprimable (PDF) par norme. */
function auditFile() {
  const s = useApp.getState()
  const n: NormId[] = s.ui.norm === 'all' || s.ui.norm === 'cross' ? s.activeNorms : [s.ui.norm]
  printDoc(
    "Dossier d'audit — " + n.map((x) => NORMS[x].code).join(', '),
    n
      .map(
        (x) =>
          `<h2>${NORMS[x].code} — ${NORMS[x].nom} (${NORMS[x].version}) — couverture ${coverage(s.db, s.activeNorms, x)} %</h2><table><tr><th>Article</th><th>Exigence</th><th>Module</th><th>Preuve</th><th>Couverture</th></tr>${s.db.mapping
            .filter((m) => m.norme === x)
            .map(
              (m) =>
                `<tr><td>§${m.article}</td><td>${esc(m.libelle)}</td><td>${esc(m.module)}</td><td>${esc(m.preuve)}</td><td>${m.couverture} %</td></tr>`
            )
            .join('')}</table>`
      )
      .join('')
  )
}

const mappingModules = () => [...new Set(useApp.getState().db.mapping.map((m) => m.module))]

/** PAGES.cover de l'original : moteur normatif et preuves. */
export function CoverPage() {
  const db = useApp((s) => s.db)
  const activeNorms = useApp((s) => s.activeNorms)
  const rows = useMemo<MappingRow[]>(
    () =>
      db.mapping
        .filter((m) => activeNorms.includes(m.norme as NormId))
        .map((m) => ({ ...m, normes: [m.norme] })),
    [db, activeNorms]
  )
  return (
    <>
      <PageHead
        kicker="Moteur normatif et preuves"
        title="Couverture normative"
        desc="Lien entre chaque exigence, le module du noyau qui la traite et la preuve attendue. La structure des normes est une donnée versionnée, jamais codée en dur."
        actions={
          <button className="btn" onClick={auditFile}>
            <Icon name="dl" size={15} /> Dossier d'audit en un clic
          </button>
        }
      />
      <div className="grid g4 mb">
        {activeNorms.map((n) => (
          <div key={n} className="card">
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <span className={`norm n${n}`}>{NORMS[n].code}</span>
              <span className="small muted">Version {NORMS[n].version}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px' }}>
              {coverage(db, activeNorms, n)} %
            </div>
            <Progress value={coverage(db, activeNorms, n)} />
            <div className="small muted" style={{ marginTop: 6 }}>
              {db.mapping.filter((m) => m.norme === n).length} exigences suivies
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <DataTable<MappingRow>
          id="mapping"
          cols={[
            { l: 'Norme', r: (m) => <NormBadges norms={[m.norme]} /> },
            { l: 'Version', k: 'version' },
            { l: 'Article', r: (m) => '§' + m.article },
            { l: 'Exigence', r: (m) => <span className="ttl">{m.libelle}</span> },
            { l: 'Module du noyau', k: 'module' },
            {
              l: 'Type',
              r: (m) => (
                <span className={`badge ${m.type === 'Commune' ? 'b-green' : 'b-amber'}`}>
                  {m.type}
                </span>
              ),
            },
            { l: 'Preuve attendue', k: 'preuve' },
            { l: 'Couverture', r: (m) => <Progress value={m.couverture} /> },
          ]}
          rows={rows}
          search={['libelle', 'article', 'module', 'preuve']}
          filters={[
            { k: 'type', l: 'Type', o: ['Commune', 'Spécifique'] },
            { k: 'module', l: 'Module', o: mappingModules },
          ]}
          exportName="Couverture_normative"
        />
      </div>
    </>
  )
}
