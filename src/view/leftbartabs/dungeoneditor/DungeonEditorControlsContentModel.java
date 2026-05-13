package src.view.leftbartabs.dungeoneditor;

final class DungeonEditorControlsContentModel {

    private final DungeonEditorMapControlsContentModel mapControls = new DungeonEditorMapControlsContentModel();
    private final DungeonEditorProjectionControlsContentModel projectionControls =
            new DungeonEditorProjectionControlsContentModel();
    private final DungeonEditorToolControlsContentModel toolControls = new DungeonEditorToolControlsContentModel();

    DungeonEditorMapControlsContentModel mapControlsContentModel() {
        return mapControls;
    }

    DungeonEditorProjectionControlsContentModel projectionControlsContentModel() {
        return projectionControls;
    }

    DungeonEditorToolControlsContentModel toolControlsContentModel() {
        return toolControls;
    }

    void apply(DungeonEditorContributionModel.ControlsProjection projection) {
        DungeonEditorContributionModel.ControlsProjection resolvedProjection = projection == null
                ? DungeonEditorContributionModel.ControlsProjection.initial()
                : projection;
        boolean hasMap = !resolvedProjection.selectedMapKey().isBlank();
        boolean busy = resolvedProjection.busy();
        mapControls.showMaps(
                resolvedProjection.mapEntries().stream()
                        .map(DungeonEditorMapControlsContentModel.MapItem::from)
                        .toList(),
                resolvedProjection.selectedMapKey(),
                busy,
                resolvedProjection.statusText());
        projectionControls.showLevels(
                resolvedProjection.projectionLevel(),
                busy,
                hasMap);
        projectionControls.showOverlaySettings(
                DungeonEditorProjectionControlsView.toSettings(resolvedProjection.overlayProjection()),
                busy);
        projectionControls.showViewMode(resolvedProjection.viewModeLabel());
        toolControls.showTool(resolvedProjection.selectedToolLabel());
        mapControls.showMapEditor(resolvedProjection.mapEditorUiState());
        toolControls.showToolPalette(resolvedProjection.toolPaletteUiState());
    }
}
