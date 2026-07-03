package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorStore {
    private DungeonEditorStoreState state;

    DungeonEditorStore() {
        this(DungeonEditorStoreState.empty());
    }

    DungeonEditorStore(DungeonEditorStoreState initialState) {
        state = initialState == null ? DungeonEditorStoreState.empty() : initialState;
    }

    synchronized DungeonEditorStoreState state() {
        return state;
    }

    synchronized DungeonEditorStoreState dispatch(DungeonEditorAction action) {
        DungeonEditorAction safeAction = action == null ? DungeonEditorAction.noOp() : action;
        DungeonEditorStoreState current = state;
        DungeonEditorStoreState nextState = isUnchanged(safeAction, current)
                ? current
                : changedState(safeAction, current);
        state = nextState;
        return nextState;
    }

    private static boolean isUnchanged(
            DungeonEditorAction action,
            DungeonEditorStoreState current
    ) {
        return switch (action) {
            case DungeonEditorAction.SelectTool selectTool ->
                    current.selectedTool() == selectTool.tool();
            case DungeonEditorAction.SelectViewMode selectViewMode ->
                    current.viewMode() == selectViewMode.viewMode();
            case DungeonEditorAction.SelectMap selectMap -> Objects.equals(current.selectedMapId(), selectMap.mapId());
            case DungeonEditorAction.SetMapSummaries setMapSummaries ->
                    Objects.equals(current.mapSummaries(), setMapSummaries.mapSummaries());
            case DungeonEditorAction.SetSurfaceLoaded setSurfaceLoaded ->
                    current.surfaceLoaded() == setSurfaceLoaded.surfaceLoaded();
            case DungeonEditorAction.SetReachableLevels setReachableLevels ->
                    Objects.equals(current.reachableLevels(), setReachableLevels.reachableLevels());
            case DungeonEditorAction.SetStatusText setStatusText ->
                    Objects.equals(current.statusText(), setStatusText.statusText());
            case DungeonEditorAction.SetProjectionLevel setProjectionLevel ->
                    current.projectionLevel() == setProjectionLevel.projectionLevel();
            case DungeonEditorAction.ShiftProjectionLevel shiftProjectionLevel ->
                    shiftProjectionLevel.levelShift() == 0;
            case DungeonEditorAction.SetOverlay setOverlay ->
                    Objects.equals(current.overlaySettings(), setOverlay.overlaySettings());
            default -> false;
        };
    }

    private static DungeonEditorStoreState changedState(
            DungeonEditorAction action,
            DungeonEditorStoreState current
    ) {
        return switch (action) {
            case DungeonEditorAction.NoOp ignored -> current;
            case DungeonEditorAction.SelectTool selectTool -> current.withSelectedTool(selectTool.tool());
            case DungeonEditorAction.SelectViewMode selectViewMode -> current.withViewMode(selectViewMode.viewMode());
            case DungeonEditorAction.SelectMap selectMap -> current.withSelectedMapId(selectMap.mapId());
            case DungeonEditorAction.SetMapSummaries setMapSummaries ->
                    current.withMapSummaries(setMapSummaries.mapSummaries());
            case DungeonEditorAction.SetSurfaceLoaded setSurfaceLoaded ->
                    current.withSurfaceLoaded(setSurfaceLoaded.surfaceLoaded());
            case DungeonEditorAction.SetReachableLevels setReachableLevels ->
                    current.withReachableLevels(setReachableLevels.reachableLevels());
            case DungeonEditorAction.SetStatusText setStatusText -> current.withStatusText(setStatusText.statusText());
            case DungeonEditorAction.SetProjectionLevel setProjectionLevel ->
                    current.withProjectionLevel(setProjectionLevel.projectionLevel());
            case DungeonEditorAction.ShiftProjectionLevel shiftProjectionLevel ->
                    current.withProjectionLevel(current.projectionLevel() + shiftProjectionLevel.levelShift());
            case DungeonEditorAction.SetOverlay setOverlay -> current.withOverlaySettings(setOverlay.overlaySettings());
            case DungeonEditorAction.MarkDraftSessionChanged ignored ->
                    current.withDraftSessionRevision(current.draftSessionRevision() + 1L);
        };
    }

    synchronized <T> DungeonEditorSelectorResult<T> select(DungeonEditorSelector<T> selector) {
        DungeonEditorSelector<T> safeSelector = Objects.requireNonNull(selector, "selector");
        DungeonEditorStoreState current = state;
        return DungeonEditorSelectorResult.from(
                safeSelector.select(current),
                current);
    }
}
