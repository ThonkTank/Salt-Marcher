import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type {
  LocationSymbol,
  LocationSymbolDeleteImpact,
  LocationSymbolPage
} from '../../../shared/contracts/location-symbol.js'
import type { HexCapabilities } from './hex-capabilities.js'
import type { WorldLocationSnapshot } from '../../../shared/contracts/world-location.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'

export function useLocationSymbolController(props: {
  capabilities: Pick<HexCapabilities, 'locationSymbols' | 'runtime'>
  page: LocationSymbolPage | null
  setPage: (page: LocationSymbolPage) => void
  locationId: string
  locationsRef: RefObject<WorldLocationSnapshot | null>
  setLocations: (snapshot: WorldLocationSnapshot) => void
  onError: (cause: unknown) => void
}) {
  const { locationSymbols } = props.capabilities
  const pageRef = useRef(props.page)
  const queryRef = useRef('')
  const offsetRef = useRef(0)
  const setPageRef = useRef(props.setPage)
  const onErrorRef = useRef(props.onError)
  useEffect(() => {
    setPageRef.current = props.setPage
  }, [props.setPage])
  useEffect(() => {
    onErrorRef.current = props.onError
  }, [props.onError])
  const [selectedCustomSymbol, setSelectedCustomSymbol] =
    useState<LocationSymbol | null>(null)
  useEffect(() => {
    pageRef.current = props.page
  }, [props.page])

  const load = useCallback(
    async (query = queryRef.current, offset = offsetRef.current) => {
      queryRef.current = query
      offsetRef.current = offset
      const page = await locationSymbols.search(query, offset, 24)
      pageRef.current = page
      setPageRef.current(page)
      return page
    },
    [locationSymbols]
  )

  useEffect(
    () =>
      locationSymbols.onChanged(() => {
        void load().catch(onErrorRef.current)
      }),
    [load, locationSymbols]
  )

  const active = props.locationsRef.current?.locations.find(
    (location) => location.id === props.locationId
  )
  useEffect(() => {
    const symbolId = active?.mapPresentation.symbolId
    if (!symbolId || !symbolId.includes('-')) return
    void locationSymbols
      .detail(symbolId)
      .then(setSelectedCustomSymbol)
      .catch(() => setSelectedCustomSymbol(null))
  }, [active?.mapPresentation.symbolId, locationSymbols])

  const importAndAssign = async (displayName: string) => {
    const file = await props.capabilities.runtime.pickLocationSymbolFile()
    if (file.status === 'cancelled') return
    if (file.status === 'rejected')
      throw new CapabilityError(
        file.reason === 'too_large'
          ? 'svg_too_large'
          : file.reason === 'read_failed'
            ? 'file_read_failed'
            : 'unsupported_svg',
        false
      )
    const current = pageRef.current
    const location = props.locationsRef.current?.locations.find(
      (entry) => entry.id === props.locationId
    )
    if (!current || !location) return
    const result = await props.capabilities.locationSymbols.importAndAssign({
      commandId: crypto.randomUUID(),
      displayName,
      source: file.source,
      locationId: location.id,
      expectedSymbolRevision: current.revision,
      expectedPresentationRevision: location.mapPresentation.revision
    })
    const created = result.symbols.symbols.find(
      (candidate) => candidate.displayName === displayName
    )
    if (created) {
      setSelectedCustomSymbol(created)
      const snapshot = props.locationsRef.current
      if (snapshot)
        props.setLocations({
          ...snapshot,
          locations: snapshot.locations.map((entry) =>
            entry.id === location.id
              ? {
                  ...entry,
                  mapPresentation: {
                    ...entry.mapPresentation,
                    revision: result.presentationRevision,
                    symbolId: created.id
                  }
                }
              : entry
          )
        })
      const offset = Math.floor(created.position / 24) * 24
      await load('', offset)
    } else await load('', 0)
  }

  const rename = async (id: string, displayName: string) => {
    const current = pageRef.current
    if (!current) return
    await props.capabilities.locationSymbols.update(
      id,
      displayName,
      current.revision
    )
    await load()
  }

  const inspectDelete = (id: string): Promise<LocationSymbolDeleteImpact> =>
    props.capabilities.locationSymbols.deleteImpact(id)

  const remove = async (id: string) => {
    const current = pageRef.current
    if (!current) return
    await props.capabilities.locationSymbols.delete(
      crypto.randomUUID(),
      id,
      current.revision
    )
    setSelectedCustomSymbol(null)
    const page = await load(queryRef.current, offsetRef.current)
    if (page.symbols.length === 0 && page.offset > 0)
      await load(queryRef.current, Math.max(0, page.offset - 24))
  }

  return {
    load,
    search: (query: string) => load(query, 0),
    page: (offset: number) => load(queryRef.current, offset),
    importAndAssign,
    rename,
    inspectDelete,
    remove,
    selectedCustomSymbol:
      active?.mapPresentation.symbolId === selectedCustomSymbol?.id
        ? selectedCustomSymbol
        : null
  }
}
