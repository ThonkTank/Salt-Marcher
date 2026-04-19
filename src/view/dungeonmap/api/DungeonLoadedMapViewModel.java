package src.view.dungeonmap.api;

import java.util.List;

public record DungeonLoadedMapViewModel(
        long mapId,
        String mapName,
        long revision,
        int currentFloor,
        List<DungeonSelectionItemViewModel> selectableTargets
) {
    public DungeonLoadedMapViewModel {
        selectableTargets = selectableTargets == null ? List.of() : List.copyOf(selectableTargets);
    }
}
