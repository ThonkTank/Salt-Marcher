import { ReferenceOverlayLayer, ReferencePinnedWindow } from './reference-ui.js'
import { useReferenceContext } from './reference-context.js'

export default function ReferenceRuntime() {
  const reference = useReferenceContext()
  return (
    <>
      <ReferenceOverlayLayer />
      <div className="reference-pin-layer" aria-live="polite">
        {reference.pins.map((pin) => (
          <ReferencePinnedWindow key={pin.id} pin={pin} />
        ))}
      </div>
    </>
  )
}
