package src.domain.dungeon.model.editor.helper;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorRoomInteractionLookupHelper {

    public DungeonEditorWorkspaceValues.@Nullable Area roomArea(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable HitTarget hit
    ) {
        if (snapshot == null || hit == null) {
            return null;
        }
        if (roomHit(hit)) {
            return roomAreaById(snapshot, hit.ownerId());
        }
        if (roomLabelHit(hit)) {
            return roomAreaById(snapshot, hit.topologyRefId());
        }
        if (!clusterLabelHit(hit)) {
            return null;
        }
        return snapshot.areas().stream()
                .filter(area -> area.kind().isRoom() && area.clusterId() == hit.clusterId())
                .findFirst()
                .orElse(null);
    }

    public DungeonEditorWorkspaceValues.@Nullable Area roomAreaById(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            long roomId
    ) {
        if (snapshot == null || !DungeonEditorWorkspaceValues.hasId(roomId)) {
            return null;
        }
        return snapshot.areas().stream()
                .filter(area -> area.kind().isRoom() && area.id() == roomId)
                .findFirst()
                .orElse(null);
    }

    public DungeonEditorWorkspaceValues.Cell corridorRoomCell(
            DungeonEditorWorkspaceValues.Area room,
            int pointerQ,
            int pointerR
    ) {
        return room.cells().stream()
                .min(Comparator
                        .comparingInt((DungeonEditorWorkspaceValues.Cell cell) -> Math.abs(cell.q() - pointerQ) + Math.abs(cell.r() - pointerR))
                        .thenComparingInt(DungeonEditorWorkspaceValues.Cell::r)
                        .thenComparingInt(DungeonEditorWorkspaceValues.Cell::q))
                .orElse(new DungeonEditorWorkspaceValues.Cell(pointerQ, pointerR, 0));
    }

    public String corridorDirection(DungeonEditorWorkspaceValues.Area room, DungeonEditorWorkspaceValues.Cell roomCell) {
        Set<CellKey> roomCells = room.cells().stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        CellKey key = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (TravelHeading direction : TravelHeading.values()) {
            if (!roomCells.contains(key.neighbor(direction))) {
                return direction.name();
            }
        }
        return "";
    }

    public DungeonEditorSessionValues.Selection selectionForBoundary(BoundaryTarget boundary, long clusterId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonEditorWorkspaceValues.TopologyElementRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(boundary.topologyRefKind()),
                        boundary.topologyRefId()),
                clusterId,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static boolean roomHit(HitTarget hit) {
        return hit.kind() == HitKind.ROOM && DungeonEditorWorkspaceValues.hasId(hit.ownerId());
    }

    private static boolean roomLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL
                && DungeonEditorMainViewInteractionValues.ROOM_KIND.equals(hit.topologyRefKind())
                && DungeonEditorWorkspaceValues.hasId(hit.topologyRefId());
    }

    private static boolean clusterLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL && DungeonEditorWorkspaceValues.hasId(hit.clusterId());
    }
}
