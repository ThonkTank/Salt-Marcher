import {
  Fragment,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type PointerEvent,
  type ReactNode
} from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import {
  formatMessage,
  message as uiMessage
} from '../../i18n/catalog-runtime.de.js'
import { CreatureFilters, FilterChips } from '../creatures/creature-controls.js'
import { CreatureInspector } from '../reference/creature-inspector.js'
import {
  formatChallengeRating,
  formatInteger
} from '../../i18n/domain-formatters.de.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import './creature-collection.css'

type CreatureCollectionCatalogProps = Readonly<{
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  page: CreatureCatalogPage | null
  changed: (query: CreatureCatalogQuery) => void
  searchBiomeOptions?:
    ((query: string) => Promise<readonly SearchableSelectOption[]>) | undefined
  inspect: (creature: Creature) => void
  controls?: boolean
  showBiome?: boolean
  footerStatus?: string
  className?: string
}>

type CreatureBuilderCatalogProps = CreatureCollectionCatalogProps &
  Readonly<{
    add: (creature: Creature) => void
    quantities: Readonly<Record<string, number>>
  }>

export function CreatureBuilderCatalogTable(
  props: CreatureBuilderCatalogProps
) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  function toggleExpanded(creatureId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(creatureId)) next.delete(creatureId)
      else next.add(creatureId)
      return next
    })
  }

  return (
    <CreatureCollectionCatalogFrame {...props}>
      <table className="creature-collection-table">
        <CatalogHead showBiome={props.showBiome ?? false} actions />
        <tbody>
          {props.page?.rows.map((creature) => {
            const open = expanded.has(creature.id)
            const quantity = props.quantities[creature.id] ?? 0
            return (
              <Fragment key={creature.id}>
                <tr
                  className={`creature-collection-row${open ? ' expanded' : ''}`}
                >
                  <td>
                    <CreatureNameCell
                      creature={creature}
                      inspect={props.inspect}
                      expanded={open}
                      toggle={() => toggleExpanded(creature.id)}
                    />
                  </td>
                  <CreatureFactsCells
                    creature={creature}
                    showBiome={props.showBiome ?? false}
                  />
                  <td>
                    {quantity > 0 ? (
                      <span className="creature-collection-in-draft">
                        {formatMessage('catalog.inGroup', { quantity })}
                      </span>
                    ) : (
                      <AddCreatureButton creature={creature} add={props.add} />
                    )}
                  </td>
                </tr>
                {open && (
                  <tr className="creature-collection-expanded-row">
                    <td colSpan={props.showBiome ? 6 : 5}>
                      <CreatureInspector creature={creature} embedded />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </CreatureCollectionCatalogFrame>
  )
}

export function CreatureInspectorCatalogTable(
  props: CreatureCollectionCatalogProps
) {
  return (
    <CreatureCollectionCatalogFrame {...props}>
      <table className="creature-collection-table">
        <CatalogHead showBiome={props.showBiome ?? false} actions={false} />
        <tbody>
          {props.page?.rows.map((creature) => (
            <tr className="creature-collection-row" key={creature.id}>
              <td>
                <CreatureNameCell creature={creature} inspect={props.inspect} />
              </td>
              <CreatureFactsCells
                creature={creature}
                showBiome={props.showBiome ?? false}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </CreatureCollectionCatalogFrame>
  )
}

export function EncounterTableCreatureCatalogTable(
  props: CreatureBuilderCatalogProps
) {
  return (
    <CreatureCollectionCatalogFrame {...props}>
      <table className="creature-collection-table">
        <thead>
          <tr>
            <th>{uiMessage('ui.monster')}</th>
            <th>{uiMessage('ui.cr')}</th>
            <th>{uiMessage('ui.aktionen')}</th>
          </tr>
        </thead>
        <tbody>
          {props.page?.rows.map((creature) => {
            const selected = (props.quantities[creature.id] ?? 0) > 0
            return (
              <tr className="creature-collection-row" key={creature.id}>
                <td>
                  <CreatureNameCell
                    creature={creature}
                    inspect={props.inspect}
                  />
                </td>
                <td>{formatChallengeRating(creature.challengeRating)}</td>
                <td>
                  <AddCreatureButton
                    creature={creature}
                    add={props.add}
                    selected={selected}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </CreatureCollectionCatalogFrame>
  )
}

function CreatureCollectionCatalogFrame(
  props: CreatureCollectionCatalogProps & { children: ReactNode }
) {
  return (
    <section
      className={`creature-collection-pane${props.className ? ` ${props.className}` : ''}`}
      aria-label={uiMessage('ui.monsterkatalog')}
    >
      {props.controls !== false && (
        <>
          <div className="creature-collection-summary">
            <strong>{uiMessage('ui.monsterkatalog')}</strong>
            <span>{props.page?.message}</span>
          </div>
          <CreatureFilters
            query={props.query}
            options={props.options}
            searchBiomeOptions={props.searchBiomeOptions}
            changed={props.changed}
            compact
          />
          <div className="creatures-filter-chips">
            <FilterChips
              query={props.query}
              options={props.options}
              changed={props.changed}
            />
          </div>
        </>
      )}
      <div className="creature-collection-table-wrap">
        {props.children}
        {props.page?.status === 'empty' && (
          <p className="creature-collection-empty">{props.page.message}</p>
        )}
      </div>
      <CatalogPagination {...props} />
    </section>
  )
}

function CatalogHead(props: { showBiome: boolean; actions: boolean }) {
  return (
    <thead>
      <tr>
        <th>{uiMessage('ui.monster')}</th>
        <th>{uiMessage('ui.cr')}</th>
        <th>{uiMessage('ui.typ')}</th>
        {props.showBiome && <th>{uiMessage('catalog.environment')}</th>}
        <th>{uiMessage('ui.xp.2')}</th>
        {props.actions && <th>{uiMessage('ui.aktionen')}</th>}
      </tr>
    </thead>
  )
}

function CreatureNameCell(props: {
  creature: Creature
  inspect: (creature: Creature) => void
  expanded?: boolean
  toggle?: () => void
}) {
  return (
    <span className="creature-collection-name-cell">
      {props.toggle && (
        <button
          type="button"
          className="creature-collection-expand"
          aria-expanded={props.expanded}
          aria-label={formatMessage(
            props.expanded ? 'catalog.hideCreature' : 'catalog.showCreature',
            { name: props.creature.name }
          )}
          onClick={props.toggle}
        >
          {props.expanded ? '▾' : '▸'}
        </button>
      )}
      <button
        type="button"
        className="creature-collection-link"
        onClick={() => props.inspect(props.creature)}
      >
        {props.creature.name}
      </button>
    </span>
  )
}

function CreatureFactsCells(props: { creature: Creature; showBiome: boolean }) {
  return (
    <>
      <td>{formatChallengeRating(props.creature.challengeRating)}</td>
      <td>{props.creature.type}</td>
      {props.showBiome && <td>{props.creature.biomes.join(', ') || '—'}</td>}
      <td>{formatInteger(props.creature.xp)}</td>
    </>
  )
}

function AddCreatureButton(props: {
  creature: Creature
  add: (creature: Creature) => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      disabled={props.selected}
      aria-label={formatMessage('catalog.addCreature', {
        name: props.creature.name
      })}
      onClick={() => props.add(props.creature)}
    >
      {props.selected ? '✓' : '+'}
    </button>
  )
}

function CatalogPagination(props: CreatureCollectionCatalogProps) {
  return (
    <footer className="creature-collection-pane-footer">
      <span>
        {props.footerStatus ||
          props.page?.message ||
          formatMessage('catalog.monsterCount', {
            count: props.page?.total ?? 0
          })}
      </span>
      <div>
        <button
          type="button"
          disabled={!props.page || props.query.offset === 0}
          onClick={() =>
            props.changed({
              ...props.query,
              offset: Math.max(0, props.query.offset - props.query.limit)
            })
          }
        >
          {uiMessage('ui.zurueck')}
        </button>
        <span>{Math.floor(props.query.offset / props.query.limit) + 1}</span>
        <button
          type="button"
          disabled={
            !props.page ||
            props.query.offset + props.query.limit >= props.page.total
          }
          onClick={() =>
            props.changed({
              ...props.query,
              offset: props.query.offset + props.query.limit
            })
          }
        >
          {uiMessage('ui.weiter')}
        </button>
      </div>
    </footer>
  )
}

export function CreatureCollectionSelection(props: {
  label: string
  selectLabel: string
  value: string | null
  emptyLabel: string
  newLabel?: string
  choices: readonly { id: string; label: string }[]
  changed: (value: string | null) => void
}) {
  return (
    <div className="creature-collection-selection">
      <label>
        {props.label}
        <select
          aria-label={props.selectLabel}
          value={props.value ?? ''}
          onChange={(event) => props.changed(event.target.value || null)}
        >
          <option value="">{props.emptyLabel}</option>
          {props.newLabel && <option value="new">{props.newLabel}</option>}
          {props.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      {props.newLabel && (
        <button type="button" onClick={() => props.changed('new')}>
          {props.newLabel}
        </button>
      )}
    </div>
  )
}

export function CreatureCollectionManagerDialog(props: {
  title: string
  titleId?: string
  heading?: ReactNode
  kicker?: string
  closeLabel: string
  closeClassName?: string
  close: () => void
  busy?: boolean
  tools?: ReactNode
  toolsLabel?: string
  headerControls?: ReactNode
  catalog: ReactNode
  divider: CreatureCollectionDivider
  draft: ReactNode
  footer: ReactNode
  className?: string
  headerClassName?: string
  toolsClassName?: string
  layoutClassName?: string
  footerClassName?: string
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}) {
  const generatedTitleId = useId()
  const titleId = props.titleId ?? generatedTitleId
  return (
    <ModalDialog
      className={`creature-collection-manager${props.tools ? ' creature-collection-manager-with-tools' : ''}${props.className ? ` ${props.className}` : ''}`}
      {...(props.heading && !props.titleId
        ? { ariaLabel: props.title }
        : { labelledBy: titleId })}
      onClose={props.close}
      {...(props.onKeyDown ? { onKeyDown: props.onKeyDown } : {})}
      {...(props.busy === undefined ? {} : { busy: props.busy })}
    >
      <header className={props.headerClassName}>
        {props.heading ?? (
          <div>
            {props.kicker && <p className="section-kicker">{props.kicker}</p>}
            <h2 id={titleId}>{props.title}</h2>
          </div>
        )}
        {props.headerControls}
        <ModalCloseButton
          className={props.closeClassName}
          aria-label={props.closeLabel}
        >
          ×
        </ModalCloseButton>
      </header>
      {props.tools && (
        <section
          className={`creature-collection-tools${props.toolsClassName ? ` ${props.toolsClassName}` : ''}`}
          aria-label={props.toolsLabel}
        >
          {props.tools}
        </section>
      )}
      <div
        className={`creature-collection-layout${props.layoutClassName ? ` ${props.layoutClassName}` : ''}`}
        style={
          props.divider.kind === 'resizable'
            ? ({
                '--creature-collection-draft-width': `${props.divider.value}px`
              } as CSSProperties)
            : undefined
        }
      >
        <div className="creature-collection-catalog">{props.catalog}</div>
        <CreatureCollectionDividerHandle divider={props.divider} />
        <div className="creature-collection-draft">{props.draft}</div>
      </div>
      <footer
        className={`creature-collection-footer creature-collection-manager-footer${props.footerClassName ? ` ${props.footerClassName}` : ''}`}
      >
        {props.footer}
      </footer>
    </ModalDialog>
  )
}

export type CreatureCollectionDivider =
  | { kind: 'fixed' }
  | {
      kind: 'resizable'
      value: number
      minimum: number
      maximum: number
      label: string
      changed: (value: number) => void
    }

function CreatureCollectionDividerHandle(props: {
  divider: CreatureCollectionDivider
}) {
  const divider = props.divider
  if (divider.kind === 'fixed')
    return <div className="creature-collection-divider" aria-hidden="true" />

  const clamp = (value: number) =>
    Math.max(divider.minimum, Math.min(divider.maximum, value))
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const layout = event.currentTarget.closest('.creature-collection-layout')
    if (!layout) return
    const bounds = layout.getBoundingClientRect()
    const update = (clientX: number) =>
      divider.changed(clamp(Math.round(bounds.right - clientX)))
    update(event.clientX)
    const move = (next: globalThis.PointerEvent) => update(next.clientX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    divider.changed(clamp(divider.value + direction * 10))
  }
  return (
    <div
      className="creature-collection-divider"
      role="separator"
      aria-label={divider.label}
      aria-orientation="vertical"
      aria-valuemin={divider.minimum}
      aria-valuemax={divider.maximum}
      aria-valuenow={divider.value}
      tabIndex={0}
      onPointerDown={resize}
      onKeyDown={keyboard}
    />
  )
}
