package src.view.leftbartabs.dungeontravel;

import java.util.Comparator;
import java.util.List;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class DungeonTravelControlsContentModel {

    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("");
    private final ReadOnlyBooleanWrapper overlayDisabled = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyStringWrapper zoomLabel = new ReadOnlyStringWrapper("Zoom: 100%");
    private final ReadOnlyStringWrapper projectionLevelLabel = new ReadOnlyStringWrapper("Ebene z=0");
    private final ReadOnlyObjectWrapper<OverlayPanelState> overlayPanelState =
            new ReadOnlyObjectWrapper<>(OverlayPanelState.from(OverlaySettings.defaults(), false));
    private final ReadOnlyBooleanWrapper projectionNavigationDisabled = new ReadOnlyBooleanWrapper(false);

    ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    ReadOnlyBooleanProperty overlayDisabledProperty() {
        return overlayDisabled.getReadOnlyProperty();
    }

    ReadOnlyStringProperty zoomLabelProperty() {
        return zoomLabel.getReadOnlyProperty();
    }

    ReadOnlyStringProperty projectionLevelLabelProperty() {
        return projectionLevelLabel.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<OverlayPanelState> overlayPanelStateProperty() {
        return overlayPanelState.getReadOnlyProperty();
    }

    ReadOnlyBooleanProperty projectionNavigationDisabledProperty() {
        return projectionNavigationDisabled.getReadOnlyProperty();
    }

    List<OverlayModeOption> overlayModeOptions() {
        return List.of(
                overlayModeOption(DungeonTravelContributionModel.OverlayMode.OFF),
                overlayModeOption(DungeonTravelContributionModel.OverlayMode.NEARBY),
                overlayModeOption(DungeonTravelContributionModel.OverlayMode.SELECTED));
    }

    void showMapName(String nextMapName) {
        mapName.set(nextMapName == null ? "" : nextMapName);
    }

    void showProjectionLevel(int nextProjectionLevel) {
        projectionLevelLabel.set("Ebene z=" + nextProjectionLevel);
    }

    void showOverlaySettings(OverlaySettings nextOverlaySettings, boolean disabled) {
        OverlaySettings safeSettings = nextOverlaySettings == null ? OverlaySettings.defaults() : nextOverlaySettings;
        overlayDisabled.set(disabled);
        applyOverlayPanelState(OverlayPanelState.from(safeSettings, disabled));
    }

    void showZoom(double nextZoom) {
        zoomLabel.set("Zoom: " + Math.round(nextZoom * 100.0) + "%");
    }

    private void applyOverlayPanelState(OverlayPanelState nextState) {
        OverlayPanelState safeState = nextState == null
                ? OverlayPanelState.from(OverlaySettings.defaults(), false)
                : nextState;
        overlayPanelState.set(safeState);
    }

    private static OverlayModeOption overlayModeOption(DungeonTravelContributionModel.OverlayMode mode) {
        DungeonTravelContributionModel.OverlayMode safeMode = DungeonTravelContributionModel.OverlayMode.safe(mode);
        return new OverlayModeOption(
                safeMode.key(),
                safeMode.controlsLabel(),
                safeMode.usesRange(),
                safeMode.usesSelectedLevels());
    }

    record OverlayModeOption(
            String key,
            String label,
            boolean rangeVisible,
            boolean selectedLevelsVisible
    ) {

        @Override
        public String toString() {
            return label;
        }
    }

    record OverlaySettings(
            DungeonTravelContributionModel.OverlayMode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        OverlaySettings {
            mode = DungeonTravelContributionModel.OverlayMode.safe(mode);
            levelRange = Math.max(1, levelRange);
            opacity = Math.max(0.1, Math.min(0.9, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        static OverlaySettings defaults() {
            return new OverlaySettings(DungeonTravelContributionModel.OverlayMode.OFF, 2, 0.35, List.of());
        }
    }

    record OverlayPanelState(
            String modeKey,
            int levelRange,
            double opacityPercent,
            String selectedLevelsText,
            boolean rangeVisible,
            boolean selectedVisible,
            boolean controlsDisabled,
            String triggerText
    ) {

        static OverlayPanelState from(OverlaySettings settings, boolean disabled) {
            OverlaySettings safeSettings = settings == null ? OverlaySettings.defaults() : settings;
            DungeonTravelContributionModel.OverlayMode safeMode =
                    DungeonTravelContributionModel.OverlayMode.safe(safeSettings.mode());
            return new OverlayPanelState(
                    safeMode.key(),
                    safeSettings.levelRange(),
                    safeSettings.opacity() * 100.0,
                    OverlayText.formatLevels(safeSettings.selectedLevels()),
                    safeMode.usesRange(),
                    safeMode.usesSelectedLevels(),
                    disabled,
                    OverlayText.summaryText(safeSettings));
        }

        boolean rangeDisabled() {
            return controlsDisabled || !rangeVisible;
        }

        boolean selectedLevelsDisabled() {
            return controlsDisabled || !selectedVisible;
        }
    }

    private enum OverlayText {
        ;

        private static String summaryText(OverlaySettings settings) {
            OverlaySettings resolved = settings == null ? OverlaySettings.defaults() : settings;
            return switch (resolved.mode()) {
                case OFF -> "Overlay: Aus";
                case NEARBY -> "Overlay: Nachbarn +/-" + resolved.levelRange()
                        + " " + percentageText(resolved.opacity());
                case SELECTED -> "Overlay: Auswahl z=" + levelsSummary(resolved.selectedLevels())
                        + " " + percentageText(resolved.opacity());
            };
        }

        private static String formatLevels(List<Integer> levels) {
            return (levels == null ? List.<Integer>of() : levels).stream()
                    .map(String::valueOf)
                    .sorted(Comparator.comparingInt(Integer::parseInt))
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }

        private static String levelsSummary(List<Integer> levels) {
            String formatted = formatLevels(levels);
            return formatted.isBlank() ? "-" : formatted;
        }

        private static String percentageText(double opacity) {
            return Math.round(opacity * 100.0) + "%";
        }
    }
}
