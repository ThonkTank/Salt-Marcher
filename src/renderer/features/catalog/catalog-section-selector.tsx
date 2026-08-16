import { message } from '../../i18n/catalog-runtime.de.js'

export type CatalogSection =
  'monsters' | 'locations' | 'factions' | 'npcs' | 'encounterTables'

const sections: readonly {
  id: CatalogSection
  label: Parameters<typeof message>[0]
}[] = [
  { id: 'monsters', label: 'ui.monster' },
  { id: 'locations', label: 'ui.orte' },
  { id: 'factions', label: 'ui.fraktionen' },
  { id: 'npcs', label: 'ui.npcs' },
  { id: 'encounterTables', label: 'ui.encounter.tabellen' }
]

export function CatalogSectionSelector(props: {
  section: CatalogSection
  select: (section: CatalogSection) => void
}) {
  return (
    <header className="catalog-section-selector">
      {sections.map((section) => (
        <button
          key={section.id}
          aria-pressed={props.section === section.id}
          onClick={() => props.select(section.id)}
        >
          {message(section.label)}
        </button>
      ))}
    </header>
  )
}
