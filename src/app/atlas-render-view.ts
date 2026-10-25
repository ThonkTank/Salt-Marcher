import type { AtlasRenderView } from './campaign-atlas-contracts';
import type { DrawingMapView } from './drawing-contracts';
import type { WorkspaceGeometry } from './contracts';
export function workspaceGeometryOnly(w: WorkspaceGeometry): WorkspaceGeometry {
  return {
    ...w,
    rooms: w.rooms.map(({ id, scopeId, floorId, name, number, revision, polygons }) => ({
      id,
      scopeId,
      floorId,
      name,
      number,
      revision,
      polygons,
    })),
  };
}
export function drawingGeometryOnly(view: DrawingMapView): DrawingMapView {
  const { keyContent: unusedKeys, ...drawing } = view;
  return {
    ...drawing,
    hiddenRooms: drawing.hiddenRooms.map(
      ({ id, scopeId, floorId, name, number, revision, polygons }) => ({
        id,
        scopeId,
        floorId,
        name,
        number,
        revision,
        polygons,
      }),
    ),
    elements: drawing.elements.map((e) => {
      const {
        notes: unusedNotes,
        content: unusedContent,
        ...shape
      } = e as typeof e & { notes?: string; content?: unknown };
      return shape;
    }),
  };
}
export function atlasGeometryOnly(a: AtlasRenderView): AtlasRenderView {
  const { keyDescription: unusedDescription, contents: unusedContents, ...geometry } = a.geometry;
  const workspace = workspaceGeometryOnly(a.workspace);
  return {
    ...a,
    workspace,
    geometry: {
      ...geometry,
      rooms: workspace.rooms,
      drawing: { ...drawingGeometryOnly(a.geometry.drawing), hiddenRooms: [] },
    },
  };
}
