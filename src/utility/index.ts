// The utility entry intentionally delegates runtime composition and dispatch.
// Keeping this leaf tiny makes process bootstrap auditable and side-effectful
// feature wiring independently testable.
import './application.js'
