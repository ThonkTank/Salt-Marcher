package features.world.dungeonmap.service;

import java.util.List;

public record DungeonTopologyReconcileContext(
        List<Long> primaryRoomPriority,
        List<EditedCell> editedCells,
        List<EditedCell> componentPriorityCells
) {

    private static final DungeonTopologyReconcileContext EMPTY = new DungeonTopologyReconcileContext(List.of(), List.of(), List.of());

    public DungeonTopologyReconcileContext {
        primaryRoomPriority = primaryRoomPriority == null ? List.of() : List.copyOf(primaryRoomPriority);
        editedCells = editedCells == null ? List.of() : List.copyOf(editedCells);
        componentPriorityCells = componentPriorityCells == null ? List.of() : List.copyOf(componentPriorityCells);
    }

    public static DungeonTopologyReconcileContext empty() {
        return EMPTY;
    }

    public record EditedCell(
            int x,
            int y
    ) {
    }
}
