import { NpcCatalogBrowser } from './npc-catalog-browser.js'
import type { NpcCatalogController } from './npc-catalog-controller.js'
import { NpcCatalogEditor } from './npc-catalog-editor.js'
import { NpcCatalogInspector } from './npc-catalog-inspector.js'

export default function NpcCatalogSection(props: {
  controller: NpcCatalogController
}) {
  const controller = props.controller
  return (
    <div className="npc-catalog-layout" data-npc-state={controller.status}>
      <NpcCatalogBrowser controller={controller} />
      <NpcCatalogInspector
        projection={controller.selectedProjection}
        edit={(npc) => controller.setEditing(npc)}
      />
      {controller.editing !== undefined && (
        <NpcCatalogEditor
          npc={controller.editing}
          conflict={controller.conflict}
          factions={controller.factions}
          locations={controller.locations}
          creatureOptions={controller.creatureOptions}
          searchCreatures={controller.searchCreatures}
          close={() => controller.setEditing(undefined)}
          save={controller.save}
        />
      )}
    </div>
  )
}
