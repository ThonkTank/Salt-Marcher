package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorControlsProjectionServiceAssembly {

    private DungeonEditorControlsProjectionServiceAssembly() {
    }

    static DungeonEditorControlProjection snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext
    ) {
        return snapshot(snapshot, surfaceContext.reachableLevels(), surfaceContext.surfacePresent());
    }

    static DungeonEditorControlProjection snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.ControlsData controls,
            DungeonEditorControlProjection current
    ) {
        DungeonEditorControlProjection safeCurrent = current == null
                ? DungeonEditorControlProjection.empty("")
                : current;
        features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.ControlsData safeControls =
                controls == null
                        ? features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.controlsData(null)
                        : controls;
        return new DungeonEditorControlProjection(
                safeCurrent.maps(),
                toPublishedMapId(safeControls.selectedMapId()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeControls.viewMode()),
                safeControls.toolSelection(),
                safeControls.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeControls.overlaySettings()),
                safeCurrent.reachableLevels(),
                safeCurrent.surfaceLoaded(),
                statusText(safeControls.statusText(), safeControls.commandOutcome()),
                safeControls.commandOutcome());
    }

    private static DungeonEditorControlProjection snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            List<Integer> reachableLevels,
            boolean surfacePresent
    ) {
        return new DungeonEditorControlProjection(
                publishedMapSummaries(snapshot.maps()),
                toPublishedMapId(snapshot.selectedMapId()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                snapshot.toolSelection(),
                snapshot.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                reachableLevels,
                surfacePresent,
                statusText(snapshot.statusText(), snapshot.commandOutcome()),
                snapshot.commandOutcome());
    }

    private static String statusText(
            String fallback,
            features.dungeon.api.editor.DungeonEditorCommandOutcome outcome
    ) {
        String outcomeText = DungeonEditorCommandStatusMessages.message(outcome);
        return outcomeText.isBlank() ? fallback : outcomeText;
    }

    private static List<features.dungeon.api.DungeonMapSummary> publishedMapSummaries(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary> maps
    ) {
        List<features.dungeon.api.DungeonMapSummary> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary map
                : maps == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
            result.add(toPublishedMapSummary(map));
        }
        return List.copyOf(result);
    }

    private static features.dungeon.api.DungeonMapSummary toPublishedMapSummary(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary map
    ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary(
                        new features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId(1L),
                        "Dungeon Map",
                        0L)
                : map;
        return new features.dungeon.api.DungeonMapSummary(
                new features.dungeon.api.DungeonMapId(safeMap.mapId().value()),
                safeMap.mapName(),
                safeMap.revision());
    }

    private static features.dungeon.api.DungeonMapId toPublishedMapId(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId mapId
    ) {
        return mapId == null ? null : new features.dungeon.api.DungeonMapId(mapId.value());
    }
}
