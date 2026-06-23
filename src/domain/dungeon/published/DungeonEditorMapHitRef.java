package src.domain.dungeon.published;

public record DungeonEditorMapHitRef(String value) {
    private static final String EMPTY_KIND = "EMPTY";

    public DungeonEditorMapHitRef {
        value = value == null ? "" : value;
    }

    public static DungeonEditorMapHitRef empty() {
        return new DungeonEditorMapHitRef("");
    }

    public static DungeonEditorMapHitRef cell(
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef
    ) {
        return cell(elementKind, ownerId, clusterId, topologyKind(topologyRef), topologyId(topologyRef));
    }

    public static DungeonEditorMapHitRef cell(
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId
    ) {
        return new DungeonEditorMapHitRef("cell:"
                + normalizeKind(elementKind)
                + ":" + Math.max(0L, ownerId)
                + ":" + Math.max(0L, clusterId)
                + ":" + normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId));
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonEdgeRef edge
    ) {
        return edge(kind, ownerId, topologyKind(topologyRef), topologyId(topologyRef), edge);
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            String topologyKind,
            long topologyId,
            DungeonEdgeRef edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return empty();
        }
        return edge(
                kind,
                ownerId,
                topologyKind,
                topologyId,
                edge.from().level(),
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r());
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            String topologyKind,
            long topologyId,
            int level,
            double startQ,
            double startR,
            double endQ,
            double endR
    ) {
        return new DungeonEditorMapHitRef("edge:"
                + normalizeKind(kind)
                + ":" + Math.max(0L, ownerId)
                + ":" + normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + level
                + ":" + sceneCoordinate(startQ)
                + ":" + sceneCoordinate(startR)
                + ":" + sceneCoordinate(endQ)
                + ":" + sceneCoordinate(endR));
    }

    public static DungeonEditorMapHitRef label(
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef,
            String labelKind
    ) {
        return label(ownerId, clusterId, topologyKind(topologyRef), topologyId(topologyRef), labelKind);
    }

    public static DungeonEditorMapHitRef label(
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef,
            String labelKind
    ) {
        return label(ownerId, clusterId, topologyKind(topologyRef), topologyId(topologyRef), labelKind);
    }

    public static DungeonEditorMapHitRef label(
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            String labelKind
    ) {
        return new DungeonEditorMapHitRef("label:"
                + Math.max(0L, ownerId)
                + ":" + Math.max(0L, clusterId)
                + ":" + normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + normalizeKind(labelKind));
    }

    public static DungeonEditorMapHitRef marker(DungeonEditorHandleRef ref, DungeonCellRef cell) {
        if (ref == null || ref.kind() == null || cell == null) {
            return empty();
        }
        return marker(ref, cell.q(), cell.r(), cell.level());
    }

    public static DungeonEditorMapHitRef marker(DungeonEditorHandleRef ref, int q, int r, int level) {
        if (ref == null || ref.kind() == null) {
            return empty();
        }
        return new DungeonEditorMapHitRef("marker:"
                + ref.kind().name()
                + ":" + topologyKind(ref.topologyRef())
                + ":" + topologyId(ref.topologyRef())
                + ":" + ref.ownerId()
                + ":" + ref.clusterId()
                + ":" + ref.corridorId()
                + ":" + ref.roomId()
                + ":" + ref.index()
                + ":" + q
                + ":" + r
                + ":" + level
                + ":" + ref.direction());
    }

    public static DungeonEditorMapHitRef graphNode(long roomId, long clusterId) {
        return new DungeonEditorMapHitRef("graph-node:ROOM:"
                + Math.max(0L, roomId)
                + ":" + Math.max(0L, clusterId));
    }

    public static String topologyKind(DungeonEditorTopologyElementRef ref) {
        return ref == null ? EMPTY_KIND : ref.kind();
    }

    public static long topologyId(DungeonEditorTopologyElementRef ref) {
        return ref == null ? 0L : ref.id();
    }

    public static String topologyKind(DungeonTopologyElementRef ref) {
        return ref == null || ref.kind() == null ? EMPTY_KIND : ref.kind().name();
    }

    public static long topologyId(DungeonTopologyElementRef ref) {
        return ref == null ? 0L : ref.id();
    }

    private static String normalizeKind(String kind) {
        return kind == null || kind.isBlank() ? EMPTY_KIND : kind.strip();
    }

    private static int sceneCoordinate(double coordinate) {
        return (int) Math.round(coordinate);
    }
}
