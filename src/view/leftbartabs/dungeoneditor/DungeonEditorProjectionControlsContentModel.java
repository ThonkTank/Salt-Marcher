package src.view.leftbartabs.dungeoneditor;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelContentModel;

final class DungeonEditorProjectionControlsContentModel {

    private final ReadOnlyObjectWrapper<ProjectionState> projection =
            new ReadOnlyObjectWrapper<>(ProjectionState.initial());

    ReadOnlyObjectProperty<ProjectionState> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void showLevels(int activeLevel, boolean busy, boolean navigationEnabled) {
        ProjectionState current = projection.get();
        projection.set(new ProjectionState(
                activeLevel,
                busy,
                navigationEnabled,
                current.overlaySettings(),
                current.overlayDisabled(),
                current.viewMode()));
    }

    void showOverlaySettings(DungeonControlPanelContentModel.OverlaySettings settings, boolean disabled) {
        ProjectionState current = projection.get();
        projection.set(new ProjectionState(
                current.activeLevel(),
                current.busy(),
                current.navigationEnabled(),
                settings,
                disabled,
                current.viewMode()));
    }

    void showViewMode(String viewMode) {
        ProjectionState current = projection.get();
        projection.set(new ProjectionState(
                current.activeLevel(),
                current.busy(),
                current.navigationEnabled(),
                current.overlaySettings(),
                current.overlayDisabled(),
                viewMode));
    }

    record ProjectionState(
            int activeLevel,
            boolean busy,
            boolean navigationEnabled,
            DungeonControlPanelContentModel.OverlaySettings overlaySettings,
            boolean overlayDisabled,
            String viewMode
    ) {
        ProjectionState {
            activeLevel = Math.max(0, activeLevel);
            overlaySettings = overlaySettings == null
                    ? DungeonControlPanelContentModel.OverlaySettings.defaults()
                    : overlaySettings;
            viewMode = viewMode == null ? "" : viewMode;
        }

        static ProjectionState initial() {
            return new ProjectionState(
                    0,
                    false,
                    false,
                    DungeonControlPanelContentModel.OverlaySettings.defaults(),
                    false,
                    "");
        }
    }
}
