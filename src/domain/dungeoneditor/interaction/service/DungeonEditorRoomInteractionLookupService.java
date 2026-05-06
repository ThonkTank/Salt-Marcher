package src.domain.dungeoneditor.interaction.service;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public final class DungeonEditorRoomInteractionLookupService {

    public @Nullable DungeonAreaSnapshot roomArea(@Nullable DungeonSnapshot snapshot, @Nullable HitTarget hit) {
        if (snapshot == null || snapshot.map() == null || hit == null) {
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
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == hit.clusterId())
                .findFirst()
                .orElse(null);
    }

    public @Nullable DungeonAreaSnapshot roomAreaById(@Nullable DungeonSnapshot snapshot, long roomId) {
        if (snapshot == null || snapshot.map() == null || roomId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.id() == roomId)
                .findFirst()
                .orElse(null);
    }

    public DungeonCellRef corridorRoomCell(DungeonAreaSnapshot room, int pointerQ, int pointerR) {
        return room.cells().stream()
                .min(Comparator
                        .comparingInt((DungeonCellRef cell) -> Math.abs(cell.q() - pointerQ) + Math.abs(cell.r() - pointerR))
                        .thenComparingInt(DungeonCellRef::r)
                        .thenComparingInt(DungeonCellRef::q))
                .orElse(new DungeonCellRef(pointerQ, pointerR, 0));
    }

    public String corridorDirection(DungeonAreaSnapshot room, DungeonCellRef roomCell) {
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
                new DungeonTopologyElementRef(
                        DungeonEditorMainViewInteractionValues.toPublishedTopologyKind(boundary.topologyRefKind()),
                        boundary.topologyRefId()),
                clusterId,
                false,
                null);
    }
}
