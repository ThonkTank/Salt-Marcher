package src.domain.dungeon.model.map.helper;

import java.util.List;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

public final class DungeonDefaultPublishedStateHelper {

    private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

    private DungeonDefaultPublishedStateHelper() {
    }

    public static DungeonAuthoredReadResult authoredRead() {
        return new DungeonAuthoredReadResult.CommittedSnapshot(snapshot());
    }

    public static DungeonAuthoredMutationResult authoredMutation() {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                snapshot(),
                List.of(),
                List.of()));
    }

    public static DungeonTravelResponse travel() {
        return new DungeonTravelResponse.Surface(new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                DEFAULT_DUNGEON_NAME,
                0,
                DungeonMapSnapshot.empty(),
                new DungeonTravelPosition(
                        new DungeonMapId(1L),
                        DungeonTravelLocationKind.TILE,
                        0L,
                        new DungeonCellRef(0, 0, 0),
                        DungeonTravelHeading.defaultHeading()),
                DEFAULT_DUNGEON_NAME,
                "Kein Standort",
                "",
                "",
                "",
                "",
                List.of()));
    }

    private static DungeonSnapshot snapshot() {
        return new DungeonSnapshot(
                DEFAULT_DUNGEON_NAME,
                DungeonMapMode.EDITOR,
                DungeonMapSnapshot.empty(),
                List.of(),
                List.of(),
                0);
    }
}
