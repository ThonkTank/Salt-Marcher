package src.domain.dungeoneditor.interaction.service;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorRoomInteractionLookupService {

    public DungeonEditorWorkspaceValues.@Nullable Area roomArea(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable HitTarget hit
    ) {
        if (snapshot == null || hit == null) {
            return null;
        }
        if (hit.kind() == HitKind.ROOM && hit.ownerId() > 0L) {
            return roomAreaById(snapshot, hit.ownerId());
        }
        if (hit.kind() == HitKind.LABEL
                && DungeonEditorMainViewInteractionValues.ROOM_KIND.equals(hit.topologyRefKind())
                && hit.topologyRefId() > 0L) {
            return roomAreaById(snapshot, hit.topologyRefId());
        }
        if (hit.kind() != HitKind.LABEL || hit.clusterId() <= 0L) {
            return null;
        }
        return snapshot.areas().stream()
                .filter(area -> area.kind() == DungeonEditorWorkspaceValues.AreaKind.ROOM && area.clusterId() == hit.clusterId())
                .findFirst()
                .orElse(null);
    }

    public DungeonEditorWorkspaceValues.@Nullable Area roomAreaById(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            long roomId
    ) {
        if (snapshot == null || roomId <= 0L) {
            return null;
        }
        return snapshot.areas().stream()
                .filter(area -> area.kind() == DungeonEditorWorkspaceValues.AreaKind.ROOM && area.id() == roomId)
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
}
