package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

public final class DungeonEditorCellHitRefs {
    private DungeonEditorCellHitRefs() {
    }

    public static DungeonEditorMapHitRef cell(
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId
    ) {
        return new DungeonEditorMapHitRef("cell:"
                + DungeonEditorMapHitRefs.normalizeKind(elementKind)
                + ":" + Math.max(0L, ownerId)
                + ":" + Math.max(0L, clusterId)
                + ":" + DungeonEditorMapHitRefs.normalizeKind(topologyKind)
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
            return DungeonEditorMapHitRefs.empty();
        }
        return exactCell(
                elementKind,
                ownerId,
                clusterId,
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef),
                DungeonEditorTopologyHitRefs.topologyId(topologyRef),
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
