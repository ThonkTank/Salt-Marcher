package src.view.views;

import java.util.List;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;

/**
 * Display-owned projection consumed by the reusable dungeon map view.
 */
public record DungeonMapDisplayModel(
        String title,
        String subtitle,
        String modeLabel,
        String statusLabel,
        String summaryLabel,
        boolean mapLoaded,
        String overlayMessage,
        RenderTopology topology,
        List<RenderCell> cells,
        List<RenderEdge> edges
) {

    public DungeonMapDisplayModel {
        title = title == null || title.isBlank() ? "Dungeon Map" : title;
        subtitle = subtitle == null ? "" : subtitle;
        modeLabel = modeLabel == null ? "" : modeLabel;
        statusLabel = statusLabel == null ? "" : statusLabel;
        summaryLabel = summaryLabel == null ? "" : summaryLabel;
        overlayMessage = overlayMessage == null ? "" : overlayMessage;
        topology = topology == null ? RenderTopology.SQUARE : topology;
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }

    public static DungeonMapDisplayModel empty() {
        return new DungeonMapDisplayModel(
                "Dungeon Map",
                "",
                "",
                "",
                "",
                false,
                "No dungeon map loaded.",
                RenderTopology.SQUARE,
                List.of(),
                List.of());
    }

    public static DungeonMapDisplayModel empty(String title) {
        return new DungeonMapDisplayModel(
                title,
                "",
                "",
                "",
                "",
                false,
                "No dungeon map loaded.",
                RenderTopology.SQUARE,
                List.of(),
                List.of());
    }

    public static DungeonMapDisplayModel fromDungeonSnapshot(DungeonSnapshot snapshot, String placeholderTitle) {
        if (snapshot == null) {
            return empty(placeholderTitle);
        }
        DungeonMapSnapshot map = snapshot.map();
        var renderedCells = map.areas().stream()
                .flatMap(area -> area.cells().stream().map(cell -> renderCell(area, cell)))
                .toList();
        var renderedEdges = map.boundaries().stream()
                .filter(boundary -> boundary.edge() != null
                        && boundary.edge().from() != null
                        && boundary.edge().to() != null)
                .map(DungeonMapDisplayModel::renderEdge)
                .toList();
        boolean mapLoaded = !renderedCells.isEmpty();
        return new DungeonMapDisplayModel(
                snapshot.mapName(),
                map.width() + " x " + map.height() + " squares",
                snapshot.mode().name(),
                "Revision " + snapshot.revision(),
                renderedCells.size() + " cells, " + renderedEdges.size() + " edges",
                mapLoaded,
                mapLoaded ? "" : "No dungeon map geometry available.",
                topology(map.topology()),
                renderedCells,
                renderedEdges);
    }

    private static RenderCell renderCell(DungeonAreaSnapshot area, DungeonCellRef cell) {
        boolean room = area.kind() == DungeonAreaKind.ROOM;
        boolean corridor = area.kind() == DungeonAreaKind.CORRIDOR;
        return new RenderCell(
                cell.q(),
                cell.r(),
                area.label(),
                room,
                corridor,
                false,
                true,
                false,
                room ? "room" : "corridor",
                area.id(),
                "area");
    }

    private static RenderEdge renderEdge(DungeonBoundarySnapshot boundary) {
        DungeonEdgeRef edge = boundary.edge();
        return new RenderEdge(
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r(),
                boundary.kind(),
                boundary.label(),
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.kind(),
                boundary.id(),
                "boundary");
    }

    private static RenderTopology topology(DungeonTopologyKind topology) {
        return topology == DungeonTopologyKind.HEX
                ? RenderTopology.HEX
                : RenderTopology.SQUARE;
    }

    public enum RenderTopology {
        SQUARE,
        HEX
    }

    public record RenderCell(
            int q,
            int r,
            String label,
            boolean room,
            boolean corridor,
            boolean blocked,
            boolean interactive,
            boolean current,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public RenderCell {
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }

    public record RenderEdge(
            int fromQ,
            int fromR,
            int toQ,
            int toR,
            String kind,
            String label,
            boolean interactive,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public RenderEdge {
            kind = kind == null || kind.isBlank() ? "edge" : kind;
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }
}
