package src.features.dungeon.runtime;

import java.util.LinkedHashMap;
import java.util.Map;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorMapInteractionFrames {
    private DungeonEditorMapInteractionFrames() {
    }

    static DungeonEditorPreparedFrameFacts.MapInteractionFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonEditorSurface surface = safeSnapshot.surface();
        if (surface == null) {
            return DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty();
        }
        Map<String, DungeonEditorRuntimePointerTarget> targets = new LinkedHashMap<>();
        DungeonEditorMapSnapshot map = surface.map();
        DungeonEditorStateSnapshot.Selection selection = safeSnapshot.selection();
        if (safeSnapshot.viewMode() == DungeonEditorViewMode.GRAPH) {
            DungeonEditorGraphPointerTargets.addTargets(targets, map);
        } else {
            DungeonEditorGridPointerTargetAssembler.addTargets(
                    targets,
                    map,
                    selection,
                    safeSnapshot.preview(),
                    safeSnapshot);
        }
        return new DungeonEditorPreparedFrameFacts.MapInteractionFrame(
                preparedTargets(targets),
                DungeonEditorHandlePointerTargets.previewHandleHitRefs(safeSnapshot, selection));
    }

    private static Map<String, DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame> preparedTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets
    ) {
        if (targets == null || targets.isEmpty()) {
            return Map.of();
        }
        Map<String, DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame> preparedTargets = new LinkedHashMap<>();
        for (Map.Entry<String, DungeonEditorRuntimePointerTarget> entry : targets.entrySet()) {
            preparedTargets.put(
                    entry.getKey(),
                    DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame.fromRuntime(entry.getValue()));
        }
        return Map.copyOf(preparedTargets);
    }
}
