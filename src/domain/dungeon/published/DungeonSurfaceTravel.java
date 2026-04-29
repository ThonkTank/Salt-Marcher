package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonSurfaceTravel(
        DungeonTravelContextKind contextKind,
        DungeonTravelPosition position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<DungeonTravelActionSnapshot> actions,
        @Nullable DungeonTravelMoveStatus moveStatus,
        @Nullable DungeonTravelExternalTarget externalTarget
) {

    public DungeonSurfaceTravel {
        contextKind = contextKind == null ? DungeonTravelContextKind.DUNGEON : contextKind;
        position = position == null
                ? new DungeonTravelPosition(
                        new DungeonMapId(1L),
                        DungeonTravelLocationKind.TILE,
                        0L,
                        new DungeonCellRef(0, 0, 0),
                        DungeonTravelHeading.defaultHeading())
                : position;
        surfaceTitle = surfaceTitle == null ? "" : surfaceTitle.trim();
        areaLabel = areaLabel == null ? "" : areaLabel.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
