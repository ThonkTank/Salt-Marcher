package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPolicy;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;

public final class DungeonEditorSessionEditOutcome {

    private final DungeonLayout layout;
    private final boolean replaceSelection;
    private final DungeonSelection focusSelection;
    private final boolean clearTransientState;
    private final CorridorSelectionIntent corridorSelectionIntent;
    private final DungeonClusterVertexRef nextWallAnchor;

    private DungeonEditorSessionEditOutcome(
            DungeonLayout layout,
            boolean replaceSelection,
            DungeonSelection focusSelection,
            boolean clearTransientState,
            CorridorSelectionIntent corridorSelectionIntent,
            DungeonClusterVertexRef nextWallAnchor
    ) {
        this.layout = layout;
        this.replaceSelection = replaceSelection;
        this.focusSelection = focusSelection;
        this.clearTransientState = clearTransientState;
        this.corridorSelectionIntent = corridorSelectionIntent;
        this.nextWallAnchor = nextWallAnchor;
    }

    public static DungeonEditorSessionEditOutcome preserveSelection(DungeonLayoutEditResult result) {
        return new DungeonEditorSessionEditOutcome(result.layout(), false, null, false, CorridorSelectionIntent.none(), null);
    }

    public static DungeonEditorSessionEditOutcome focusedLayout(DungeonLayoutEditResult result) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                CorridorSelectionIntent.none(),
                null);
    }

    public static DungeonEditorSessionEditOutcome wallLayout(DungeonLayoutEditResult result, DungeonClusterVertexRef nextWallAnchor) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                CorridorSelectionIntent.none(),
                nextWallAnchor);
    }

    public static DungeonEditorSessionEditOutcome corridorDoorLayout(
            DungeonLayoutEditResult result,
            long corridorId,
            long roomId
    ) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                CorridorSelectionIntent.door(corridorId, roomId),
                null);
    }

    public static DungeonEditorSessionEditOutcome corridorWaypointLayout(
            DungeonLayoutEditResult result,
            long corridorId,
            int waypointIndex
    ) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                CorridorSelectionIntent.waypoint(corridorId, waypointIndex),
                null);
    }

    public static DungeonEditorSessionEditOutcome resetCorridorDoorLayout(DungeonLayoutEditResult result) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                CorridorSelectionIntent.none(),
                null);
    }

    public static DungeonEditorSessionEditOutcome deleteCorridorWaypointLayout(
            DungeonLayoutEditResult result,
            long corridorId,
            int deletedWaypointIndex
    ) {
        return new DungeonEditorSessionEditOutcome(
                result.layout(),
                true,
                DungeonEditorSelectionPolicy.focusedTarget(result.layout(), result),
                true,
                survivingWaypointSelection(result.layout(), corridorId, deletedWaypointIndex),
                null);
    }

    public DungeonLayout layout() {
        return layout;
    }

    public boolean replaceSelection() {
        return replaceSelection;
    }

    public DungeonSelection focusSelection() {
        return focusSelection;
    }

    public boolean clearTransientState() {
        return clearTransientState;
    }

    public CorridorSelectionIntent corridorSelectionIntent() {
        return corridorSelectionIntent;
    }

    public DungeonClusterVertexRef nextWallAnchor() {
        return nextWallAnchor;
    }

    private static CorridorSelectionIntent survivingWaypointSelection(
            DungeonLayout layout,
            long corridorId,
            int deletedWaypointIndex
    ) {
        if (layout == null) {
            return CorridorSelectionIntent.none();
        }
        var corridor = layout.findCorridor(corridorId);
        if (corridor == null || corridor.waypoints().isEmpty()) {
            return CorridorSelectionIntent.none();
        }
        int nextIndex = Math.min(deletedWaypointIndex, corridor.waypoints().size() - 1);
        return CorridorSelectionIntent.waypoint(corridorId, nextIndex);
    }

    public sealed interface CorridorSelectionIntent {
        record None() implements CorridorSelectionIntent {}
        record Door(long corridorId, long roomId) implements CorridorSelectionIntent {}
        record Waypoint(long corridorId, int waypointIndex) implements CorridorSelectionIntent {}

        static CorridorSelectionIntent none() {
            return new None();
        }

        static CorridorSelectionIntent door(long corridorId, long roomId) {
            return new Door(corridorId, roomId);
        }

        static CorridorSelectionIntent waypoint(long corridorId, int waypointIndex) {
            return new Waypoint(corridorId, waypointIndex);
        }
    }
}
