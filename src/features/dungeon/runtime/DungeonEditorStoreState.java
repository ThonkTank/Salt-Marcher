package src.features.dungeon.runtime;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

// Project-health debt PH-20260709-001 satellite: broad transient runtime store state is listed in the register.
record DungeonEditorStoreState(
        DungeonEditorStoreVersion version,
        DungeonEditorTool selectedTool,
        DungeonEditorViewMode viewMode,
        @Nullable DungeonMapId selectedMapId,
        List<DungeonMapSummary> mapSummaries,
        boolean surfaceLoaded,
        List<Integer> reachableLevels,
        String statusText,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings,
        long draftSessionRevision
) {
    private static final DungeonEditorTool DEFAULT_SELECTED_TOOL = DungeonEditorTool.SELECT;
    private static final DungeonEditorViewMode DEFAULT_VIEW_MODE = DungeonEditorViewMode.GRID;
    private static final List<Integer> DEFAULT_REACHABLE_LEVELS = List.of(0);

    DungeonEditorStoreState {
        version = DungeonEditorStoreVersion.orInitial(version);
        selectedTool = normalizeSelectedTool(selectedTool);
        viewMode = normalizeViewMode(viewMode);
        mapSummaries = normalizeMapSummaries(mapSummaries);
        reachableLevels = normalizeReachableLevels(reachableLevels);
        statusText = normalizeStatusText(statusText);
        overlaySettings = normalizeOverlaySettings(overlaySettings);
        draftSessionRevision = normalizeDraftSessionRevision(draftSessionRevision);
    }

    static DungeonEditorStoreState empty() {
        return new DungeonEditorStoreState(
                DungeonEditorStoreVersion.initial(),
                DEFAULT_SELECTED_TOOL,
                DEFAULT_VIEW_MODE,
                null,
                List.of(),
                false,
                DEFAULT_REACHABLE_LEVELS,
                "",
                0,
                DungeonOverlaySettings.defaults(),
                0L);
    }

    static DungeonEditorTool normalizeSelectedTool(DungeonEditorTool selectedTool) {
        return selectedTool == null ? DEFAULT_SELECTED_TOOL : selectedTool;
    }

    static DungeonEditorViewMode normalizeViewMode(DungeonEditorViewMode viewMode) {
        return viewMode == null ? DEFAULT_VIEW_MODE : viewMode;
    }

    static List<DungeonMapSummary> normalizeMapSummaries(List<DungeonMapSummary> mapSummaries) {
        return mapSummaries == null ? List.of() : List.copyOf(mapSummaries);
    }

    static List<Integer> normalizeReachableLevels(List<Integer> reachableLevels) {
        return reachableLevels == null ? DEFAULT_REACHABLE_LEVELS : List.copyOf(reachableLevels);
    }

    static String normalizeStatusText(String statusText) {
        return statusText == null ? "" : statusText;
    }

    static DungeonOverlaySettings normalizeOverlaySettings(DungeonOverlaySettings overlaySettings) {
        return overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    static long normalizeDraftSessionRevision(long draftSessionRevision) {
        return Math.max(0L, draftSessionRevision);
    }

    DungeonEditorStoreState withSelectedTool(DungeonEditorTool nextSelectedTool) {
        return new DungeonEditorStoreState(
                version.next(),
                nextSelectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withViewMode(DungeonEditorViewMode nextViewMode) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                nextViewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withSelectedMapId(@Nullable DungeonMapId nextSelectedMapId) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                nextSelectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withMapSummaries(List<DungeonMapSummary> nextMapSummaries) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                nextMapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withSurfaceLoaded(boolean nextSurfaceLoaded) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                nextSurfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withReachableLevels(List<Integer> nextReachableLevels) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                nextReachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withStatusText(String nextStatusText) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                nextStatusText,
                projectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withProjectionLevel(int nextProjectionLevel) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                nextProjectionLevel,
                overlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withOverlaySettings(DungeonOverlaySettings nextOverlaySettings) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                nextOverlaySettings,
                draftSessionRevision);
    }

    DungeonEditorStoreState withDraftSessionRevision(long nextDraftSessionRevision) {
        return new DungeonEditorStoreState(
                version.next(),
                selectedTool,
                viewMode,
                selectedMapId,
                mapSummaries,
                surfaceLoaded,
                reachableLevels,
                statusText,
                projectionLevel,
                overlaySettings,
                nextDraftSessionRevision);
    }
}
