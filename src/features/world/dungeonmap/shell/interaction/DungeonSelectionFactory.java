package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import javafx.geometry.Point2D;

import java.util.List;

public final class DungeonSelectionFactory {

    private static final Point2D SYNTHETIC_CANVAS_POINT = new Point2D(0.0, 0.0);
    private static final Point2i SYNTHETIC_GRID_CELL = new Point2i(0, 0);
    private static final DungeonHitProbe SYNTHETIC_PROBE = new DungeonHitProbe(
            SYNTHETIC_CANVAS_POINT,
            SYNTHETIC_GRID_CELL,
            0,
            0.0,
            0.0,
            1.0);
    private static final DungeonHitSurface SYNTHETIC_SURFACE =
            new DungeonHitSurface.TileCellSurface(SYNTHETIC_GRID_CELL, 0);

    private DungeonSelectionFactory() {
    }

    // Legacy target-key selection survives only as a bridge until all call sites pass real selections.
    public static DungeonSelection ownerSelection(String targetKey) {
        DungeonHitSubject subject = subjectForTargetKey(targetKey);
        if (subject == null) {
            return null;
        }
        DungeonHitDescriptor descriptor = new DungeonHitDescriptor(subject, List.of(SYNTHETIC_SURFACE));
        long priority = DungeonHitConventions.basePriority(subject.kind());
        DungeonHitCandidate candidate = new DungeonHitCandidate(
                descriptor,
                SYNTHETIC_SURFACE,
                0.0,
                priority,
                priority);
        DungeonHitSnapshot snapshot = new DungeonHitSnapshot(SYNTHETIC_PROBE, List.of(candidate));
        return new DungeonSelection(snapshot, List.of(candidate));
    }

    private static DungeonHitSubject subjectForTargetKey(String targetKey) {
        if (targetKey == null || targetKey.isBlank()) {
            return null;
        }
        if (RoomCluster.isTargetKey(targetKey)) {
            return new DungeonHitSubject.ClusterLabelSubject(RoomCluster.clusterIdFromKey(targetKey));
        }
        if (Room.isTargetKey(targetKey)) {
            return new DungeonHitSubject.RoomSubject(Room.roomIdFromKey(targetKey), null);
        }
        if (Corridor.isTargetKey(targetKey)) {
            return new DungeonHitSubject.CorridorSubject(Corridor.corridorIdFromKey(targetKey), 0);
        }
        if (DungeonStair.isTargetKey(targetKey)) {
            return new DungeonHitSubject.StairSubject(DungeonStair.stairIdFromKey(targetKey));
        }
        if (DungeonTransition.isTargetKey(targetKey)) {
            return new DungeonHitSubject.TransitionSubject(DungeonTransition.transitionIdFromKey(targetKey));
        }
        return null;
    }
}
