package src.domain.dungeon.published;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;

public record DungeonSurfacePayload(
        String mapName,
        DungeonSurfaceKind surfaceKind,
        DungeonMapMode mode,
        int revision,
        DungeonMapSnapshot map,
        @Nullable DungeonMapSnapshot previewMap,
        List<String> aggregateSummaries,
        List<String> relationSummaries,
        @Nullable DungeonInspectorSnapshot inspector,
        @Nullable DungeonSurfaceTravel travel,
        DungeonSurfaceMessages messages
) {

    public DungeonSurfacePayload {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        surfaceKind = surfaceKind == null ? DungeonSurfaceKind.defaultKind() : surfaceKind;
        mode = mode == null ? DungeonMapMode.defaultMode() : mode;
        revision = Math.max(0, revision);
        map = map == null ? DungeonMapSnapshot.empty() : map;
        aggregateSummaries = aggregateSummaries == null ? List.of() : List.copyOf(aggregateSummaries);
        relationSummaries = relationSummaries == null ? List.of() : List.copyOf(relationSummaries);
        messages = messages == null ? DungeonSurfaceMessages.empty() : messages;
    }

    public boolean hasPreviewMap() {
        return previewMap != null && !previewMap.equals(map);
    }

    public List<Integer> reachableLevels(int fallbackLevel) {
        TreeSet<Integer> levels = new TreeSet<>();
        map.areas().forEach(area -> addCellLevels(levels, area.cells()));
        for (DungeonFeatureSnapshot feature : map.features()) {
            addCellLevels(levels, feature.cells());
        }
        map.editorHandles().forEach(handle -> levels.add(handle.cell().level()));
        if (previewMap != null) {
            previewMap.areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonFeatureSnapshot feature : previewMap.features()) {
                addCellLevels(levels, feature.cells());
            }
            previewMap.editorHandles().forEach(handle -> levels.add(handle.cell().level()));
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<DungeonCellRef> cells) {
        for (DungeonCellRef cell : cells == null ? List.<DungeonCellRef>of() : cells) {
            levels.add(cell.level());
        }
    }
}
