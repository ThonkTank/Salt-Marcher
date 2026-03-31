package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
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

    public static DungeonSelection ownerSelection(DungeonHitSubject subject) {
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
}
