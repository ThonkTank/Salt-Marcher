package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;

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
            GridPoint activeCell,
            int activeLevelZ
    ) {
        if (!event.isPrimaryButton()
                || activeCell == null
                || activeLevelZ != snapshot.probe().levelZ()
                || !activeCell.equals(snapshot.probe().gridCell())) {
            return false;
        }
        DungeonSelectionRef ref = snapshot.firstRefMatching(candidate ->
                isRuntimeSelectable(candidate) && refOwnsActiveCell(activeMap, activeCell, activeLevelZ, candidate));
        return ref != null;
    }

    private static boolean isRuntimeSelectable(DungeonSelectionRef ref) {
        return ref instanceof DungeonSelectionRef.RoomRef
                || ref instanceof DungeonSelectionRef.CorridorRef
                || ref instanceof DungeonSelectionRef.StairRef
                || ref instanceof DungeonSelectionRef.TransitionRef;
    }

    private static boolean refOwnsActiveCell(
            DungeonLayout activeMap,
            GridPoint activeCell,
            int activeLevelZ,
            DungeonSelectionRef ref
    ) {
        return switch (ref) {
            case DungeonSelectionRef.RoomRef roomRef -> roomOwnsActiveCell(activeMap, activeCell, activeLevelZ, roomRef);
            case DungeonSelectionRef.CorridorRef corridorRef -> activeMap.corridorsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(corridor -> corridor != null && Objects.equals(corridor.corridorId(), corridorRef.corridorId()));
            case DungeonSelectionRef.StairRef stairRef -> activeMap.stairsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(stair -> stair != null && Objects.equals(stair.stairId(), stairRef.stairId()));
            case DungeonSelectionRef.TransitionRef transitionRef -> activeMap.transitionsAtCell(activeCell, activeLevelZ).stream()
                    .anyMatch(transition -> transition != null && Objects.equals(transition.transitionId(), transitionRef.transitionId()));
            default -> false;
        };
    }

    private static boolean roomOwnsActiveCell(
            DungeonLayout activeMap,
            GridPoint activeCell,
            int activeLevelZ,
            DungeonSelectionRef.RoomRef roomRef
    ) {
        RoomCluster cluster = activeMap == null || activeCell == null ? null : activeMap.clusterAtCell(activeCell, activeLevelZ);
        Room room = cluster == null ? null : cluster.structure().roomTopology().roomAt(activeCell, activeLevelZ);
        if (room != null && !cluster.structure().roomTopology().structureFor(room).surfaceAtLevel(activeLevelZ).floor().contains(activeCell)) {
            room = null;
        }
        return room != null && Objects.equals(room.roomId(), roomRef.roomId());
    }
}
