package features.dungeon.adapter.javafx.map;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.application.editor.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import features.dungeon.application.editor.DungeonEditorPreparedFrameFacts.PreparedTopologyKind;

final class DungeonMapRenderElementFactory {

    private DungeonMapRenderElementFactory() {
    }

    static DungeonMapRenderState.Label roomLabel(
            String label,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            List<DungeonMapRenderState.Cell> areaCells,
            DungeonMapRoomLabelPlanner roomLabelPlanner,
            boolean selected,
            boolean preview
    ) {
        DungeonMapRoomLabelPlanner safePlacementModel =
                roomLabelPlanner == null
                        ? new DungeonMapRoomLabelPlanner()
                        : roomLabelPlanner;
        DungeonMapRoomLabelPlanner.RoomLabelPlacement placement =
                safePlacementModel.placementFor(areaCells);
        int labelLevel = areaCells.isEmpty() ? 0 : areaCells.getFirst().z();
        return new DungeonMapRenderState.Label(
                label,
                placement.centerQ(),
                placement.centerR(),
                labelLevel,
                ownerId,
                clusterId,
                topologyRef,
                PreparedLabelKind.ROOM_LABEL,
                selected,
                preview,
                placement.availableLengthScene(),
                placement.rotationDegrees());
    }

    static DungeonMapRenderState.Label roomLabel(
            DungeonEditorMapSnapshot.Area area,
            List<DungeonMapRenderState.Cell> areaCells,
            DungeonMapRoomLabelPlanner roomLabelPlanner,
            boolean selected,
            boolean preview
    ) {
        return roomLabel(
                area.label(),
                area.id(),
                DungeonMapRenderCells.clusterId(area),
                DungeonMapRenderCells.areaTopologyRef(area),
                areaCells,
                roomLabelPlanner,
                selected,
                preview);
    }

    static boolean invalidEdge(@Nullable DungeonEdgeRef edge) {
        return edge == null || edge.from() == null || edge.to() == null;
    }

    static RenderCellCenter centerOfCells(List<DungeonMapRenderState.Cell> cells) {
        double q = 0.0;
        double r = 0.0;
        for (DungeonMapRenderState.Cell cell : cells == null ? List.<DungeonMapRenderState.Cell>of() : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells == null ? 0 : cells.size());
        return new RenderCellCenter(q / count, r / count);
    }

    static DungeonMapRenderState.TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(topologyKind(ref.kind()), ref.id());
    }

    static PreparedLabelKind labelKind(String value) {
        if (value == null || value.isBlank()) {
            return PreparedLabelKind.EMPTY;
        }
        try {
            return PreparedLabelKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return PreparedLabelKind.EMPTY;
        }
    }

    static PreparedTopologyKind topologyKind(String value) {
        if (value == null || value.isBlank()) {
            return PreparedTopologyKind.EMPTY;
        }
        try {
            return PreparedTopologyKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return PreparedTopologyKind.EMPTY;
        }
    }

    static PreparedTopologyKind topologyKind(Enum<?> value) {
        return value == null ? PreparedTopologyKind.EMPTY : topologyKind(value.name());
    }

    record RenderCellCenter(double q, double r) {
    }
}
