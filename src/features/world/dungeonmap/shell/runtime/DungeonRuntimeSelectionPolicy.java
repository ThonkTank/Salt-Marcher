package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;

import java.util.Objects;

public final class DungeonRuntimeSelectionPolicy {

    public boolean canBeginDrag(
            DungeonLayout activeMap,
            DungeonCanvasPointerEvent event,
            DungeonHitSnapshot snapshot,
            DungeonRuntimeNavigationSnapshot activeNavigation
    ) {
        DungeonHitSnapshot resolvedSnapshot = Objects.requireNonNull(snapshot, "snapshot");
        if (activeMap == null || event == null || activeNavigation == null || activeNavigation.isEmpty()) {
            return false;
        }
        return decidePress(activeMap, event, resolvedSnapshot, activeNavigation.cell(), activeNavigation.levelZ());
    }

    public boolean canContinueDrag(
            DungeonCanvasPointerEvent event,
            DungeonDragService.DungeonDragSession dragSession
    ) {
        return dragSession != null && event != null && event.isPrimaryButtonDown();
    }

    public boolean canDrop(DungeonDragService.DungeonDragSession dragSession) {
        return dragSession != null;
    }

    private static boolean decidePress(
            DungeonLayout activeMap,
            DungeonCanvasPointerEvent event,
            DungeonHitSnapshot snapshot,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (!event.isPrimaryButton()
                || activeCell == null
                || activeLevelZ != snapshot.probe().levelZ()
                || !activeCell.equals(snapshot.probe().gridCell())) {
            return false;
        }
        DungeonHitSubject subject = snapshot.firstSubjectMatching(candidate ->
                isRuntimeSelectable(candidate) && subjectOwnsActiveCell(activeMap, activeCell, activeLevelZ, candidate));
        return subject != null;
    }

    private static boolean isRuntimeSelectable(DungeonHitSubject subject) {
        return subject instanceof DungeonHitSubject.RoomSubject
                || subject instanceof DungeonHitSubject.CorridorSubject
                || subject instanceof DungeonHitSubject.StairSubject
                || subject instanceof DungeonHitSubject.TransitionSubject;
    }

    private static boolean subjectOwnsActiveCell(
            DungeonLayout activeMap,
            CellCoord activeCell,
            int activeLevelZ,
            DungeonHitSubject subject
    ) {
        return switch (subject) {
            case DungeonHitSubject.RoomSubject roomSubject -> roomOwnsActiveCell(activeMap, activeCell, activeLevelZ, roomSubject);
            case DungeonHitSubject.CorridorSubject corridorSubject -> activeMap.corridorsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(corridor -> corridor != null && Objects.equals(corridor.corridorId(), corridorSubject.corridorId()));
            case DungeonHitSubject.StairSubject stairSubject -> activeMap.stairsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(stair -> stair != null && Objects.equals(stair.stairId(), stairSubject.stairId()));
            case DungeonHitSubject.TransitionSubject transitionSubject -> activeMap.transitionsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(transition -> transition != null && Objects.equals(transition.transitionId(), transitionSubject.transitionId()));
            default -> false;
        };
    }

    private static boolean roomOwnsActiveCell(
            DungeonLayout activeMap,
            CellCoord activeCell,
            int activeLevelZ,
            DungeonHitSubject.RoomSubject roomSubject
    ) {
        Room room = activeMap.roomAtCell(activeCell, activeLevelZ);
        return room != null && Objects.equals(room.roomId(), roomSubject.roomId());
    }
}
