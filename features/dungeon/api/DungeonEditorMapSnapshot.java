package features.dungeon.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorMapSnapshot(
        String topology,
        List<Area> areas,
        List<Boundary> boundaries,
        List<Feature> features,
        List<DungeonEditorHandleSnapshot> editorHandles
) {

    public DungeonEditorMapSnapshot {
        topology = topology == null || topology.isBlank() ? "SQUARE" : topology.trim();
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
        editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
    }

    public static DungeonEditorMapSnapshot empty() {
        return new DungeonEditorMapSnapshot("SQUARE", List.of(), List.of(), List.of(), List.of());
    }

    public record Area(
            String kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCellRef> cells,
            DungeonTopologyElementRef topologyRef
    ) {

        public Area {
            kind = kind == null || kind.isBlank() ? "ROOM" : kind.trim();
            id = Math.max(1L, id);
            clusterId = Math.max(0L, clusterId);
            label = label == null || label.isBlank() ? kind : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    public record Boundary(
            String kind,
            long id,
            String label,
            DungeonEdgeRef edge,
            DungeonTopologyElementRef topologyRef
    ) {

        public Boundary {
            kind = kind == null || kind.isBlank() ? "boundary" : kind.trim();
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind : label.trim();
            edge = edge == null
                    ? new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0))
                    : edge;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    public record Feature(
            String kind,
            long id,
            String label,
            List<DungeonCellRef> cells,
            String description,
            String destinationLabel,
            DungeonTopologyElementRef topologyRef,
            @Nullable DungeonEdgeRef anchorEdge
    ) {
        public Feature {
            kind = kind == null || kind.isBlank() ? "STAIR" : kind.trim();
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    public List<DungeonEditorHandleSnapshot> editorHandles() {
        return List.copyOf(editorHandles);
    }
}
