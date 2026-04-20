package src.view.views;

import java.util.List;

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
