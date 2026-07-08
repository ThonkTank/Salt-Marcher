package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;

public final class DungeonEditorMapHitRefs {
    private static final String EMPTY_KIND = "EMPTY";

    private DungeonEditorMapHitRefs() {
    }

    public static DungeonEditorMapHitRef empty() {
        return new DungeonEditorMapHitRef("");
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

    public static DungeonEditorMapHitRef exactCell(
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonCellRef cell
    ) {
        if (cell == null) {
            return empty();
        }
        return exactCell(
                elementKind,
                ownerId,
                clusterId,
                topologyKind(topologyRef),
                topologyId(topologyRef),
                cell.q(),
                cell.r(),
                cell.level());
    }

    public static DungeonEditorMapHitRef exactCell(
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            int q,
            int r,
            int level
    ) {
        return new DungeonEditorMapHitRef(cell(elementKind, ownerId, clusterId, topologyKind, topologyId).value()
                + ":" + q
                + ":" + r
                + ":" + level);
    }

    public static ExactCellHitRef parseExactCell(String hitRef) {
        if (hitRef == null) {
            return ExactCellHitRef.empty();
        }
        String[] parts = hitRef.split(":");
        int exactCellPartCount = 9;
        if (parts.length != exactCellPartCount || !"cell".equals(parts[0])) {
            return ExactCellHitRef.empty();
        }
        try {
            return new ExactCellHitRef(
                    hitRef,
                    Integer.parseInt(parts[6]),
                    Integer.parseInt(parts[7]),
                    Integer.parseInt(parts[8]));
        } catch (NumberFormatException ignored) {
            return ExactCellHitRef.empty();
        }
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

    public static DungeonEditorMapHitRef featureMarker(
            DungeonEditorTopologyElementRef topologyRef,
            long ownerId,
            int q,
            int r,
            int level
    ) {
        return featureMarker(topologyKind(topologyRef), topologyId(topologyRef), ownerId, q, r, level);
    }

    public static DungeonEditorMapHitRef featureMarker(
            String topologyKind,
            long topologyId,
            long ownerId,
            int q,
            int r,
            int level
    ) {
        return new DungeonEditorMapHitRef("marker:FEATURE:"
                + normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + Math.max(0L, ownerId)
                + ":" + q
                + ":" + r
                + ":" + level);
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

    public record ExactCellHitRef(
            String key,
            int q,
            int r,
            int level
    ) {
        public ExactCellHitRef {
            key = key == null ? "" : key.strip();
        }

        public static ExactCellHitRef empty() {
            return new ExactCellHitRef("", 0, 0, 0);
        }

        public boolean exact() {
            return !key.isBlank();
        }
    }
}
