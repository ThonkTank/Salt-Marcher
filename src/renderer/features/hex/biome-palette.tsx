import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent
} from 'react'
import {
  type BiomeDefinition,
  type BiomeDeleteImpact,
  type BiomeDraft
} from '../../../shared/contracts/biome.js'
import { anyBiomeEncounterTableId } from '../../../shared/biomes/constants.js'
import type { EncounterTable } from '../../../shared/contracts/encounter-source.js'
import { encounterTables } from '../encounter-table/encounter-table-snapshot.js'
import type { HexBiomeId } from '../../../shared/contracts/hex.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import {
  ModalCloseButton,
  ModalDialog,
  ModalForm
} from '../../shell/modal-dialog.js'
import type { BiomeCatalogCapabilities } from './biome-catalog-capabilities.js'
import { formatMessage, message } from '../../i18n/hex-runtime.de.js'

const PAGE_SIZE = 30
const COLUMN_COUNT = 3
const ROW_HEIGHT = 64
const VIEWPORT_HEIGHT = 292

type PageState = Readonly<{
  revision: number
  total: number
  items: Readonly<Record<number, BiomeDefinition>>
  ready: boolean
}>

export function BiomePalette(props: {
  capabilities: BiomeCatalogCapabilities
  selectedId: HexBiomeId
  onSelect: (biome: BiomeDefinition) => void
  onError: (message: string) => void
}) {
  const biomeApi = props.capabilities.biomes
  const onError = props.onError
  const [query, setQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const [page, setPage] = useState<PageState>({
    revision: 0,
    total: 0,
    items: {},
    ready: false
  })
  const [editing, setEditing] = useState<
    | Readonly<{
        biome: BiomeDefinition | null
        tables: readonly EncounterTable[]
      }>
    | undefined
  >()
  const generation = useRef(0)
  const requested = useRef(new Set<string>())

  const requestPage = useCallback(
    async (needle: string, offset: number, currentGeneration: number) => {
      const requestKey = `${currentGeneration}:${offset}`
      if (requested.current.has(requestKey)) return
      requested.current.add(requestKey)
      try {
        const result = await biomeApi.search(needle, offset, PAGE_SIZE)
        if (generation.current !== currentGeneration) return
        setPage((current) => {
          const minimum = Math.max(0, offset - PAGE_SIZE * 2)
          const maximum = offset + PAGE_SIZE * 3
          const retained = Object.fromEntries(
            Object.entries(current.items).filter(([index]) => {
              const value = Number(index)
              return value >= minimum && value < maximum
            })
          )
          return {
            revision: result.revision,
            total: result.total,
            ready: true,
            items: {
              ...retained,
              ...Object.fromEntries(
                result.biomes.map((biome, index) => [offset + index, biome])
              )
            }
          }
        })
      } catch (cause) {
        onError(capabilityErrorText(cause))
      } finally {
        requested.current.delete(requestKey)
      }
    },
    [biomeApi, onError]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextGeneration = ++generation.current
      requested.current.clear()
      setScrollTop(0)
      setPage({ revision: 0, total: 0, items: {}, ready: false })
      void requestPage(query.trim(), 0, nextGeneration)
    }, 180)
    return () => clearTimeout(timer)
  }, [query, refreshToken, requestPage])

  useEffect(
    () =>
      biomeApi.onChanged(() => {
        setRefreshToken((current) => current + 1)
      }),
    [biomeApi]
  )

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
  const lastRow = Math.min(
    Math.ceil(page.total / COLUMN_COUNT),
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + 2
  )
  const firstIndex = firstRow * COLUMN_COUNT
  const lastIndex = Math.min(page.total, lastRow * COLUMN_COUNT)
  const visibleIndexes = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, lastIndex - firstIndex) },
        (_, index) => firstIndex + index
      ),
    [firstIndex, lastIndex]
  )

  useEffect(() => {
    if (!page.ready || firstIndex >= page.total) return
    const firstPage = Math.floor(firstIndex / PAGE_SIZE) * PAGE_SIZE
    const finalPage =
      Math.floor(Math.max(firstIndex, lastIndex - 1) / PAGE_SIZE) * PAGE_SIZE
    for (let offset = firstPage; offset <= finalPage; offset += PAGE_SIZE)
      void requestPage(query.trim(), offset, generation.current)
  }, [firstIndex, lastIndex, page.ready, page.total, query, requestPage])

  async function openEditor(biome: BiomeDefinition | null) {
    try {
      const [definition, tables] = await Promise.all([
        biome ? props.capabilities.biomes.detail(biome.id) : null,
        props.capabilities.encounterTables.read()
      ])
      setEditing({
        biome: definition,
        tables: encounterTables(tables).filter(
          (table) =>
            table.scope === 'installation' &&
            table.id !== anyBiomeEncounterTableId
        )
      })
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  return (
    <>
      <div className="hex-biome-toolbar">
        <input
          type="search"
          aria-label={message('biome.search')}
          placeholder={message('biome.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button disabled={!page.ready} onClick={() => void openEditor(null)}>
          {message('biome.new')}
        </button>
        <button
          onClick={() =>
            void biomeApi
              .detail(props.selectedId)
              .then(openEditor)
              .catch((cause: unknown) => onError(capabilityErrorText(cause)))
          }
        >
          {message('biome.editAction')}
        </button>
      </div>
      <div
        className="hex-biome-viewport"
        role="group"
        aria-label={message('biome.palette')}
        onScroll={(event: UIEvent<HTMLDivElement>) =>
          setScrollTop(event.currentTarget.scrollTop)
        }
      >
        <div
          className="hex-biome-virtual-content"
          style={{
            height: `${Math.ceil(page.total / COLUMN_COUNT) * ROW_HEIGHT}px`
          }}
        >
          {visibleIndexes.map((index) => {
            const biome = page.items[index]
            const row = Math.floor(index / COLUMN_COUNT)
            const column = index % COLUMN_COUNT
            const position = {
              top: `${row * ROW_HEIGHT}px`,
              left: `calc(${column * (100 / COLUMN_COUNT)}% + ${column * 2}px)`,
              width: `calc(${100 / COLUMN_COUNT}% - 4px)`
            }
            if (!biome)
              return (
                <span
                  key={index}
                  className="hex-biome-tile hex-biome-loading"
                  style={position}
                  aria-hidden="true"
                />
              )
            return (
              <button
                key={biome.id}
                className="hex-biome-tile"
                aria-pressed={props.selectedId === biome.id}
                title={formatMessage('biome.tileTitle', {
                  name: biome.displayName,
                  cost: biome.passable
                    ? `${biome.travelCost}×`
                    : message('biome.impassable')
                })}
                style={{ ...position, background: biome.color }}
                onClick={() => props.onSelect(biome)}
                onDoubleClick={() => void openEditor(biome)}
              >
                <span>{biome.displayName}</span>
                <small>{biome.passable ? `${biome.travelCost}×` : '—'}</small>
              </button>
            )
          })}
        </div>
      </div>
      <small className="hex-biome-count">
        {page.ready
          ? formatMessage('biome.count', { count: page.total })
          : message('biome.loading')}
      </small>
      {editing && (
        <BiomeEditorDialog
          key={editing.biome?.id ?? 'new-biome'}
          biome={editing.biome}
          tables={editing.tables}
          revision={page.revision}
          capabilities={props.capabilities}
          close={() => setEditing(undefined)}
          saved={(biome) => {
            setEditing(undefined)
            if (biome) props.onSelect(biome)
            return Promise.resolve()
          }}
          onError={props.onError}
        />
      )}
    </>
  )
}

function BiomeEditorDialog(props: {
  biome: BiomeDefinition | null
  tables: readonly EncounterTable[]
  revision: number
  capabilities: Pick<BiomeCatalogCapabilities, 'biomes'>
  close: () => void
  saved: (biome: BiomeDefinition | null) => Promise<void>
  onError: (message: string) => void
}) {
  const [displayName, setDisplayName] = useState(props.biome?.displayName ?? '')
  const [color, setColor] = useState(props.biome?.color ?? '#7f9b63')
  const [passable, setPassable] = useState(props.biome?.passable ?? true)
  const [travelCost, setTravelCost] = useState(props.biome?.travelCost ?? 1)
  const [tableIds, setTableIds] = useState(
    new Set(props.biome?.encounterTableIds ?? [])
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [impact, setImpact] = useState<BiomeDeleteImpact | null>(null)

  const draft = (): BiomeDraft => ({
    displayName: displayName.trim(),
    color,
    passable,
    travelCost,
    encounterTableIds: props.tables
      .filter((table) => tableIds.has(table.id))
      .map((table) => table.id)
  })

  async function save() {
    if (busy || !displayName.trim()) return
    setBusy(true)
    setError('')
    try {
      const commandId = crypto.randomUUID()
      const result = props.biome
        ? await props.capabilities.biomes.update(
            commandId,
            props.biome.id,
            draft(),
            props.revision
          )
        : await props.capabilities.biomes.create(
            commandId,
            draft(),
            props.revision
          )
      await props.saved(result.biome)
    } catch (cause) {
      const errorText = capabilityErrorText(cause)
      setError(errorText)
      props.onError(errorText)
    } finally {
      setBusy(false)
    }
  }

  async function inspectDelete() {
    if (!props.biome || props.biome.kind !== 'custom') return
    setBusy(true)
    try {
      setImpact(await props.capabilities.biomes.deleteImpact(props.biome.id))
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!props.biome || props.biome.kind !== 'custom') return
    setBusy(true)
    try {
      await props.capabilities.biomes.delete(
        crypto.randomUUID(),
        props.biome.id,
        props.revision
      )
      setImpact(null)
      await props.saved(null)
    } catch (cause) {
      const errorText = capabilityErrorText(cause)
      setError(errorText)
      props.onError(errorText)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ModalDialog
        className="hex-biome-editor"
        ariaLabel={
          props.biome ? message('biome.edit') : message('biome.create')
        }
        onClose={props.close}
        busy={busy}
      >
        <ModalForm
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <header>
            <div>
              <p className="section-kicker">{message('biome.catalog')}</p>
              <h2>
                {props.biome ? message('biome.edit') : message('biome.create')}
              </h2>
            </div>
            <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
              ×
            </ModalCloseButton>
          </header>
          <label>
            {message('ui.name')}
            <input
              required
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label>
            {message('biome.color')}
            <span className="hex-biome-color-row">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
              <input
                aria-label={message('biome.colorValue')}
                pattern="#[0-9a-fA-F]{6}"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </span>
          </label>
          <label className="hex-biome-checkbox">
            <input
              type="checkbox"
              checked={passable}
              onChange={(event) => setPassable(event.target.checked)}
            />
            {message('biome.passable')}
          </label>
          <label>
            {message('biome.travelCost')}
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              disabled={!passable}
              value={travelCost}
              onChange={(event) => setTravelCost(Number(event.target.value))}
            />
          </label>
          <fieldset className="hex-biome-table-links">
            <legend>{message('biome.installationTables')}</legend>
            {props.tables.map((table) => (
              <label key={table.id}>
                <input
                  type="checkbox"
                  checked={tableIds.has(table.id)}
                  onChange={(event) => {
                    const next = new Set(tableIds)
                    if (event.target.checked) next.add(table.id)
                    else next.delete(table.id)
                    setTableIds(next)
                  }}
                />
                <span>{table.displayName}</span>
                <small>
                  {formatMessage('biome.tableEntries', {
                    count: table.entries.length
                  })}
                </small>
              </label>
            ))}
          </fieldset>
          {props.biome?.aliases.length ? (
            <p className="muted">
              {formatMessage('biome.catalogTerms', {
                aliases: props.biome.aliases.join(', ')
              })}
            </p>
          ) : null}
          {error && <p role="alert">{error}</p>}
          <footer>
            {props.biome?.kind === 'custom' && (
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void inspectDelete()}
              >
                {message('biome.delete')}
              </button>
            )}
            <span className="hex-biome-dialog-spacer" />
            <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
            <button disabled={busy || !displayName.trim()}>
              {props.biome ? message('action.save') : message('action.create')}
            </button>
          </footer>
        </ModalForm>
      </ModalDialog>
      {impact && (
        <ModalDialog
          className="hex-biome-delete-confirm"
          role="alertdialog"
          ariaLabel={formatMessage('biome.deleteAria', {
            name: impact.biomeName
          })}
          onClose={() => setImpact(null)}
          busy={busy}
        >
          <h2>{message('biome.deleteConfirm')}</h2>
          <p>
            {formatMessage('biome.deleteImpact', {
              tiles: impact.totalTiles,
              maps: impact.totalMaps
            })}
          </p>
          {impact.usages.length > 0 && (
            <ul>
              {impact.usages.flatMap((usage) =>
                usage.maps.map((map) => (
                  <li key={`${usage.campaignId}:${map.mapId}`}>
                    {usage.campaignName} · {map.mapName}: {map.tileCount}
                  </li>
                ))
              )}
            </ul>
          )}
          <footer>
            <button disabled={busy} onClick={() => setImpact(null)}>
              {message('action.cancel')}
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {message('biome.deleteAndMark')}
            </button>
          </footer>
        </ModalDialog>
      )}
    </>
  )
}
