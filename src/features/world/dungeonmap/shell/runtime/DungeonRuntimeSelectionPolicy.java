package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelection;
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
            CubePoint activeTile,
            DungeonDragService.DungeonDragSession dragSession
    ) {
        Objects.requireNonNull(phase, "phase");
        DungeonSelection selection = new DungeonSelection(
                Objects.requireNonNull(snapshot, "snapshot"),
                snapshot.candidates());
        if (activeMap == null || event == null) {
            return new DungeonSelectionDecision(selection, false, false);
        }
        return switch (phase) {
            case PRESS -> decidePress(activeMap, event, selection, activeTile);
            case DRAG -> new DungeonSelectionDecision(selection, dragSession != null && event.isPrimaryButtonDown(), false);
            case RELEASE -> new DungeonSelectionDecision(selection, dragSession != null, false);
        };
    }

    private static DungeonSelectionDecision decidePress(
            DungeonLayout activeMap,
            DungeonCanvasPointerEvent event,
            DungeonSelection selection,
            CubePoint activeTile
    ) {
        if (!event.isPrimaryButton()
                || activeTile == null
                || activeTile.z() != selection.snapshot().probe().levelZ()
                || !activeTile.projectedCell().equals(selection.snapshot().probe().gridCell())) {
            return new DungeonSelectionDecision(selection, false, false);
        }
        DungeonHitSubject subject = selection.firstSubjectMatching(candidate ->
                isRuntimeSelectable(candidate) && subjectOwnsActiveTile(activeMap, activeTile, candidate));
        if (subject == null) {
            return new DungeonSelectionDecision(selection, false, false);
        }
        return new DungeonSelectionDecision(selection, true, true);
    }

    private static boolean isRuntimeSelectable(DungeonHitSubject subject) {
        return subject instanceof DungeonHitSubject.RoomSubject
                || subject instanceof DungeonHitSubject.CorridorSubject
                || subject instanceof DungeonHitSubject.StairSubject
                || subject instanceof DungeonHitSubject.TransitionSubject;
    }

    private static boolean subjectOwnsActiveTile(DungeonLayout activeMap, CubePoint activeTile, DungeonHitSubject subject) {
        return switch (subject) {
            case DungeonHitSubject.RoomSubject roomSubject -> roomOwnsActiveTile(activeMap, activeTile, roomSubject);
            case DungeonHitSubject.CorridorSubject corridorSubject -> activeMap.corridorsAtCell(activeTile.projectedCell(), activeTile.z()).stream()
                    .anyMatch(corridor -> corridor != null && Objects.equals(corridor.corridorId(), corridorSubject.corridorId()));
            case DungeonHitSubject.StairSubject stairSubject -> activeMap.stairsAtCell(activeTile.projectedCell(), activeTile.z()).stream()
                    .anyMatch(stair -> stair != null && Objects.equals(stair.stairId(), stairSubject.stairId()));
            case DungeonHitSubject.TransitionSubject transitionSubject -> activeMap.transitionsAtCell(activeTile.projectedCell(), activeTile.z()).stream()
                    .anyMatch(transition -> transition != null && Objects.equals(transition.transitionId(), transitionSubject.transitionId()));
            default -> false;
        };
    }

    private static boolean roomOwnsActiveTile(
            DungeonLayout activeMap,
            CubePoint activeTile,
            DungeonHitSubject.RoomSubject roomSubject
    ) {
        Room room = roomAt(activeMap, activeTile);
        return room != null && Objects.equals(room.roomId(), roomSubject.roomId());
    }

    private static Room roomAt(DungeonLayout activeMap, CubePoint point) {
        if (activeMap == null || point == null) {
            return null;
        }
        for (RoomCluster cluster : activeMap.clusters()) {
            if (cluster == null) {
                continue;
            }
            Room room = cluster.roomAt(point);
            if (room != null) {
                return room;
            }
        }
        return null;
    }
}
