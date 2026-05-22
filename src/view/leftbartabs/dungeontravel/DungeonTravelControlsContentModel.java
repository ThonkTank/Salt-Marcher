package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonTravelControlsContentModel {

    private static final String MODE_OFF = "OFF";
    private static final String MODE_NEARBY = "NEARBY";
    private static final String MODE_SELECTED = "SELECTED";
    private static final String LABEL_OFF = "Aus";
    private static final String LABEL_NEARBY = "Nahe Ebenen";
    private static final String LABEL_SELECTED = "Auswahl";

    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("");
    private final ReadOnlyBooleanWrapper overlayDisabled = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyStringWrapper zoomLabel = new ReadOnlyStringWrapper("Zoom: 100%");
    private final ReadOnlyStringWrapper projectionLevelLabel = new ReadOnlyStringWrapper("Ebene z=0");
    private final ReadOnlyObjectWrapper<OverlayPanelState> overlayPanelState =
            new ReadOnlyObjectWrapper<>(OverlayPanelState.from(DungeonOverlaySettings.defaults(), false));
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
                new OverlayModeOption(MODE_OFF, LABEL_OFF, false, false),
                new OverlayModeOption(MODE_NEARBY, LABEL_NEARBY, true, false),
                new OverlayModeOption(MODE_SELECTED, LABEL_SELECTED, false, true));
    }

    void showMapName(String nextMapName) {
        mapName.set(nextMapName == null ? "" : nextMapName);
    }

    void showProjectionLevel(int nextProjectionLevel) {
        projectionLevelLabel.set("Ebene z=" + nextProjectionLevel);
    }

    void showOverlaySettings(DungeonOverlaySettings nextOverlaySettings, boolean disabled) {
        DungeonOverlaySettings safeSettings = nextOverlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : nextOverlaySettings;
        overlayDisabled.set(disabled);
        applyOverlayPanelState(OverlayPanelState.from(safeSettings, disabled));
    }

    void showZoom(double nextZoom) {
        zoomLabel.set("Zoom: " + Math.round(nextZoom * 100.0) + "%");
    }

    private void applyOverlayPanelState(OverlayPanelState nextState) {
        OverlayPanelState safeState = nextState == null
                ? OverlayPanelState.from(DungeonOverlaySettings.defaults(), false)
                : nextState;
        overlayPanelState.set(safeState);
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

        static OverlayPanelState from(DungeonOverlaySettings settings, boolean disabled) {
            DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
            String safeModeKey = normalizeModeKey(safeSettings.modeKey());
            return new OverlayPanelState(
                    safeModeKey,
                    boundedOverlayRange(safeSettings),
                    boundedOverlayOpacity(safeSettings) * 100.0,
                    OverlayText.selectedLevelList(safeSettings.selectedLevels()),
                    rangeMode(safeModeKey),
                    selectedLevelsMode(safeModeKey),
                    disabled,
                    OverlayText.triggerSummary(safeSettings));
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

        private static String triggerSummary(DungeonOverlaySettings settings) {
            DungeonOverlaySettings resolvedSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
            String percentText = opacityText(boundedOverlayOpacity(resolvedSettings));
            return switch (normalizeModeKey(resolvedSettings.modeKey())) {
                case MODE_NEARBY -> "Overlay: Nachbarn +/-" + boundedOverlayRange(resolvedSettings) + " " + percentText;
                case MODE_SELECTED -> "Overlay: Auswahl z="
                        + selectedLevelSummary(resolvedSettings.selectedLevels()) + " " + percentText;
                default -> "Overlay: Aus";
            };
        }

        private static String selectedLevelList(List<Integer> levels) {
            List<Integer> orderedLevels = (levels == null ? List.<Integer>of() : levels).stream()
                    .sorted()
                    .distinct()
                    .toList();
            StringBuilder text = new StringBuilder();
            for (Integer level : orderedLevels) {
                if (text.length() > 0) {
                    text.append(", ");
                }
                text.append(level);
            }
            return text.toString();
        }

        private static String selectedLevelSummary(List<Integer> levels) {
            String formatted = selectedLevelList(levels);
            return formatted.isBlank() ? "-" : formatted;
        }

        private static String opacityText(double opacity) {
            return Math.round(opacity * 100.0) + "%";
        }
    }

    private static int boundedOverlayRange(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(1, safeSettings.levelRange());
    }

    private static double boundedOverlayOpacity(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
    }

    private static String normalizeModeKey(@Nullable String modeKey) {
        if (MODE_NEARBY.equalsIgnoreCase(modeKey)) {
            return MODE_NEARBY;
        }
        if (MODE_SELECTED.equalsIgnoreCase(modeKey)) {
            return MODE_SELECTED;
        }
        return MODE_OFF;
    }

    private static boolean rangeMode(String modeKey) {
        return MODE_NEARBY.equals(normalizeModeKey(modeKey));
    }

    private static boolean selectedLevelsMode(String modeKey) {
        return MODE_SELECTED.equals(normalizeModeKey(modeKey));
    }
}
