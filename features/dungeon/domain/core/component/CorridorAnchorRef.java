package features.dungeon.domain.core.component;

public record CorridorAnchorRef(
        long hostCorridorId,
        long anchorId
) {

    public CorridorAnchorRef {
        hostCorridorId = Math.max(0L, hostCorridorId);
        anchorId = Math.max(0L, anchorId);
    }

    public boolean present() {
        return hostCorridorId > 0L && anchorId > 0L;
    }
}
