import type {DrawingElement} from './drawing-contracts';
import type {AtlasPathDrag} from './atlas-workbench-types';

/** Preview and commit share one immutable point edit. */
export function atlasPathPreview(original: DrawingElement, drag: AtlasPathDrag | null): DrawingElement {
    if (!drag || drag.element.id !== original.id) return original;
    const points = drag.element.points.slice();
    if (drag.insert) points.splice(drag.index + 1, 0, {...drag.point});
    else points[drag.index] = {...drag.point};
    return {...original, points};
}
