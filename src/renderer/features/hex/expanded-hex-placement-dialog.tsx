import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexMapView
} from '../../../shared/contracts/hex.js'
import { formatMessage, message } from '../../i18n/hex-runtime.de.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import './hex-location-placement.css'

export function ExpandedHexPlacementDialog(props: {
  locationName: string
  map: HexMapView
  biomes: HexBiomeCatalog
  selected: AxialCoordinate | null
  choose: (coordinate: AxialCoordinate) => void
  loadViewport: (center: AxialCoordinate, halfExtent: number) => void
  cancel: () => void
  apply: () => void
}) {
  return (
    <ModalDialog
      className="hex-placement-dialog location-expanded-map-dialog"
      ariaLabel={message('ui.ort.auf.hex.karte.platzieren')}
      onClose={props.cancel}
    >
      <header>
        <div>
          <p className="section-kicker">{message('ui.ort.platzieren')}</p>
          <h2>{props.locationName}</h2>
        </div>
        <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
          ×
        </ModalCloseButton>
      </header>
      <div className="location-expanded-map-frame">
        <HexMapCanvas
          snapshot={props.map}
          biomes={props.biomes}
          selected={props.selected}
          interaction="location"
          onTileClick={props.choose}
          onViewportChange={props.loadViewport}
          ariaLabel={formatMessage('hex.canvas.placementLabel', {
            name: props.locationName
          })}
        />
      </div>
      <footer>
        <ModalCloseButton
          onClick={(event) => {
            event.preventDefault()
            props.cancel()
          }}
        >
          {message('action.cancel')}
        </ModalCloseButton>
        <button type="button" onClick={props.apply}>
          {message('ui.auswahl.uebernehmen')}
        </button>
      </footer>
    </ModalDialog>
  )
}
