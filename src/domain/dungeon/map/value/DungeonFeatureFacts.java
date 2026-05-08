package src.domain.dungeon.map.value;

import java.util.List;
import java.util.Objects;

public final class DungeonFeatureFacts {
    private final DungeonFeatureType kind;
    private final long id;
    private final String label;
    private final List<DungeonCell> cells;
    private final String description;
    private final String destinationLabel;
    private final DungeonTopologyRef topologyRef;

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel
    ) {
        this(kind, id, label, cells, description, destinationLabel, defaultTopologyRef(kind, id));
    }

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel,
            DungeonTopologyRef topologyRef
    ) {
        this.kind = kind == null ? DungeonFeatureType.STAIR : kind;
        this.id = Math.max(1L, id);
        this.label = label == null || label.isBlank() ? this.kind.name() : label.trim();
        this.cells = cells == null ? List.of() : List.copyOf(cells);
        this.description = description == null ? "" : description.trim();
        this.destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        this.topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(this.kind), this.id)
                : topologyRef;
    }

    public DungeonFeatureType kind() {
        return kind;
    }

    public long id() {
        return id;
    }

    public String label() {
        return label;
    }

    public List<DungeonCell> cells() {
        return cells;
    }

    public String description() {
        return description;
    }

    public String destinationLabel() {
        return destinationLabel;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(DungeonFeatureType kind, long id) {
        DungeonFeatureType safeKind = kind == null ? DungeonFeatureType.STAIR : kind;
        long safeId = Math.max(1L, id);
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(safeKind), safeId);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonFeatureFacts that
                && id == that.id
                && Objects.equals(kind, that.kind)
                && Objects.equals(label, that.label)
                && Objects.equals(cells, that.cells)
                && Objects.equals(description, that.description)
                && Objects.equals(destinationLabel, that.destinationLabel)
                && Objects.equals(topologyRef, that.topologyRef);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, id, label, cells, description, destinationLabel, topologyRef);
    }

    @Override
    public String toString() {
        return "DungeonFeatureFacts[kind=" + kind
                + ", id=" + id
                + ", label=" + label
                + ", cells=" + cells
                + ", description=" + description
                + ", destinationLabel=" + destinationLabel
                + ", topologyRef=" + topologyRef
                + "]";
    }
}
