package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionDecision;

import java.util.Objects;

public final class DungeonRuntimeSelectionPolicy {

    public enum RuntimeInteractionPhase {
        PRESS,
        DRAG,
        RELEASE
    }

    public DungeonSelectionDecision select(
            RuntimeInteractionPhase phase,
            DungeonLayout activeMap,
            DungeonCanvasPointerEvent event,
            DungeonHitSnapshot snapshot,
            CellCoord activeCell,
            int activeLevelZ,
            DungeonDragService.DungeonDragSession dragSession
    ) {
        Objects.requireNonNull(phase, "phase");
        DungeonHitSnapshot resolvedSnapshot = Objects.requireNonNull(snapshot, "snapshot");
        if (activeMap == null || event == null) {
            return new DungeonSelectionDecision(resolvedSnapshot, false, false);
        }
        return switch (phase) {
            case PRESS -> decidePress(activeMap, event, resolvedSnapshot, activeCell, activeLevelZ);
            case DRAG -> new DungeonSelectionDecision(resolvedSnapshot, dragSession != null && event.isPrimaryButtonDown(), false);
            case RELEASE -> new DungeonSelectionDecision(resolvedSnapshot, dragSession != null, false);
        };
    }

    private static DungeonSelectionDecision decidePress(
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
            return new DungeonSelectionDecision(snapshot, false, false);
        }
        DungeonHitSubject subject = snapshot.firstSubjectMatching(candidate ->
                isRuntimeSelectable(candidate) && subjectOwnsActiveCell(activeMap, activeCell, activeLevelZ, candidate));
        if (subject == null) {
            return new DungeonSelectionDecision(snapshot, false, false);
        }
        return new DungeonSelectionDecision(snapshot, true, true);
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
