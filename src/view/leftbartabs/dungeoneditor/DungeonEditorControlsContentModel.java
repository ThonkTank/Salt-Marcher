package src.view.leftbartabs.dungeoneditor;

import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelContentModel;

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
                toSettings(resolvedProjection.overlayProjection()),
                busy);
        projectionControls.showViewMode(resolvedProjection.viewModeLabel());
        toolControls.showTool(resolvedProjection.selectedToolLabel());
    }

    private static DungeonControlPanelContentModel.OverlaySettings toSettings(
            DungeonEditorContributionModel.OverlayProjection settings
    ) {
        return new DungeonControlPanelContentModel.OverlaySettings(
                OverlayModeKey.fromModelKey(settings.modeKey()).overlayMode(),
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private enum OverlayModeKey {
        OFF(DungeonControlPanelContentModel.Mode.OFF),
        NEARBY(DungeonControlPanelContentModel.Mode.NEARBY),
        SELECTED(DungeonControlPanelContentModel.Mode.SELECTED);

        private final DungeonControlPanelContentModel.Mode overlayMode;

        OverlayModeKey(DungeonControlPanelContentModel.Mode overlayMode) {
            this.overlayMode = overlayMode;
        }

        private DungeonControlPanelContentModel.Mode overlayMode() {
            return overlayMode;
        }

        private static OverlayModeKey fromModelKey(String modelKey) {
            for (OverlayModeKey value : values()) {
                if (value.matches(modelKey)) {
                    return value;
                }
            }
            return OFF;
        }

        private boolean matches(String modelKey) {
            return modelKey != null && name().equalsIgnoreCase(modelKey);
        }
    }
}
