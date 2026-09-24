import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { NORMS } from '../data/referentiels'
import { optList } from '../lib/options'
import { useApp } from '../store/useApp'
import { controllers } from './formControllers'
import type { FieldDef, Rec } from './types'

const isFull = (f: FieldDef) =>
  Boolean(f.t === 'textarea' || f.full || f.t === 'multi' || f.t === 'norms' || f.t === 'file')

/** formHTML(fields, rec) de l'original — champs non contrôlés, lus à l'enregistrement. */
export function FormRenderer({
  formId,
  fields,
  rec,
}: {
  formId: string
  fields: FieldDef[]
  rec: Rec
}) {
  const root = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    controllers[formId] = () => {
      const out: Rec = {}
      const bad = new Set<string>()
      fields.forEach((f) => {
        const box = root.current!.querySelector<HTMLElement>(`[data-f="${f.k}"]`)!
        let v: unknown
        if (f.t === 'multi' || f.t === 'norms') {
          v = [...box.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value)
        } else if (f.t === 'scale') {
          const c = box.querySelector<HTMLInputElement>('input:checked')
          v = c ? Number(c.value) : null
        } else if (f.t === 'toggle') {
          v = box.querySelector<HTMLInputElement>('input')!.checked
        } else {
          const raw = box.querySelector<HTMLInputElement>('.inp')!.value.trim()
          v = f.t === 'number' ? (raw === '' ? '' : Number(raw)) : raw
        }
        const empty = v === '' || v == null || (Array.isArray(v) && !v.length)
        if ((f.req && empty) || (f.check && !empty && !f.check(v, out))) bad.add(f.k)
        out[f.k] = v
      })
      setErrors(bad)
      return bad.size ? null : out
    }
    return () => {
      delete controllers[formId]
    }
  }, [formId, fields])

  return (
    <div className="form-grid" ref={root}>
      {fields.map((f) => (
        <Field key={f.k} f={f} value={rec[f.k]} err={errors.has(f.k)} />
      ))}
    </div>
  )
}

/** fieldHTML(f, val) de l'original. */
function Field({ f, value, err }: { f: FieldDef; value: unknown; err: boolean }) {
  const id = 'f_' + f.k
  const v = Array.isArray(value) && f.t === 'textarea' ? value.join('\n') : (value ?? '')
  return (
    <div className={`field${isFull(f) ? ' full' : ''}${err ? ' err' : ''}`} data-f={f.k}>
      <label htmlFor={id}>
        {f.l}
        {f.req ? <span className="req"> *</span> : null}
      </label>
      <Input f={f} id={id} v={v} />
      {f.h ? <span className="hint">{f.h}</span> : null}
      <span className="errmsg">{f.err || 'Ce champ est obligatoire.'}</span>
    </div>
  )
}

function Input({ f, id, v }: { f: FieldDef; id: string; v: unknown }) {
  const activeNorms = useApp((s) => s.activeNorms)
  const fileRef = useRef<HTMLInputElement>(null)

  switch (f.t) {
    case 'textarea':
      return <textarea className="inp" id={id} name={f.k} defaultValue={String(v)} />

    case 'select':
      return (
        <select className="inp" id={id} name={f.k} defaultValue={String(v)}>
          {optList(f.o).map(([a, b]) => (
            <option key={a} value={a}>
              {b}
            </option>
          ))}
        </select>
      )

    case 'multi':
    case 'norms': {
      const opts =
        f.t === 'norms'
          ? activeNorms.map((n) => [n, NORMS[n].code] as [string, string])
          : optList(f.o)
      return <Chips name={f.k} opts={opts} initial={Array.isArray(v) ? v.map(String) : []} />
    }

    case 'scale': {
      const n = f.max || 5
      return (
        <div className="scale" data-scale={f.k}>
          {Array.from({ length: n }, (_, i) => (
            <label key={i}>
              <input type="radio" name={f.k} value={i + 1} defaultChecked={Number(v) === i + 1} />
              <span>{i + 1}</span>
            </label>
          ))}
        </div>
      )
    }

    case 'file':
      return (
        <div className="file-drop">
          <Icon name="up" size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="inp"
              id={id}
              name={f.k}
              defaultValue={String(v)}
              aria-label="Nom du fichier joint"
              ref={fileRef}
            />
            <div className="hint" style={{ marginTop: 4 }}>
              Glissez un fichier ou choisissez-le (PDF, Word, Excel, image — 50 Mo max)
            </div>
          </div>
          <label className="btn sm">
            Parcourir
            <input
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && fileRef.current) fileRef.current.value = file.name
              }}
            />
          </label>
        </div>
      )

    case 'toggle':
      return (
        <label className="toggle">
          <input type="checkbox" id={id} name={f.k} defaultChecked={Boolean(v)} />
          <span className="small">{f.lbl || 'Oui'}</span>
        </label>
      )

    default:
      return (
        <input
          className="inp"
          id={id}
          name={f.k}
          type={f.t || 'text'}
          defaultValue={String(v)}
          step={f.t === 'number' ? 'any' : undefined}
        />
      )
  }
}

/** Cases à cocher multiples (multi / norms) : la puce se colore quand elle est cochée. */
function Chips({
  name,
  opts,
  initial,
}: {
  name: string
  opts: [string, string][]
  initial: string[]
}) {
  const [on, setOn] = useState<Set<string>>(new Set(initial))
  return (
    <div className="chips" data-multi={name}>
      {opts.map(([a, b]) => (
        <label key={a} className={`chipbox ${on.has(a) ? 'on' : ''}`}>
          <input
            type="checkbox"
            value={a}
            defaultChecked={on.has(a)}
            onChange={(e) => {
              const next = new Set(on)
              if (e.target.checked) next.add(a)
              else next.delete(a)
              setOn(next)
            }}
          />
          {b}
        </label>
      ))}
    </div>
  )
}
