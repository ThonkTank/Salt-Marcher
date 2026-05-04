package src.domain.dungeoneditor.published;

import java.util.List;
import java.util.Locale;

public record DungeonEditorMapSnapshot(
        String topology,
        int width,
        int height,
        List<Area> areas,
        List<Boundary> boundaries,
        List<Feature> features,
        List<EditorHandle> editorHandles
) {

    public DungeonEditorMapSnapshot {
        topology = topology == null || topology.isBlank() ? "SQUARE" : topology.trim();
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
        editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
    }

    public static DungeonEditorMapSnapshot empty() {
        return new DungeonEditorMapSnapshot("SQUARE", 1, 1, List.of(), List.of(), List.of(), List.of());
    }

    public record Area(
            String kind,
            long id,
            String label,
            List<DungeonEditorCell> cells
    ) {

        public Area {
            kind = kind == null || kind.isBlank() ? "ROOM" : kind.trim();
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    public record Boundary(
            String kind,
            long id,
            String label,
            DungeonEditorEdge edge,
            DungeonEditorTopologyElementRef topologyRef
    ) {

        public Boundary {
            kind = kind == null || kind.isBlank() ? "boundary" : kind.trim();
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind : label.trim();
            edge = edge == null
                    ? new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0))
                    : edge;
            topologyRef = topologyRef == null
                    ? new DungeonEditorTopologyElementRef(kind.toUpperCase(Locale.ROOT), id)
                    : topologyRef;
        }
    }

    public record Feature(
            String kind,
            long id,
            String label,
            List<DungeonEditorCell> cells,
            String description,
            String destinationLabel
    ) {

        public Feature {
            kind = kind == null || kind.isBlank() ? "STAIR" : kind.trim();
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        }
    }

    public record EditorHandle(
            DungeonEditorHandleRef ref,
            String label,
            DungeonEditorCell cell
    ) {

        public EditorHandle {
            ref = ref == null ? DungeonEditorHandleRef.empty() : ref;
            label = label == null || label.isBlank() ? ref.kind() : label.trim();
            cell = cell == null ? ref.cell() : cell;
        }
    }
}
