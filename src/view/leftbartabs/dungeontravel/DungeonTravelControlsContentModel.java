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
                new OverlayModeOption(overlayOffMode(), "Aus", false, false),
                new OverlayModeOption(overlayNearbyMode(), "Nahe Ebenen", true, false),
                new OverlayModeOption(overlaySelectedMode(), "Auswahl", false, true));
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

    static final class OverlayModeOption {

        private final String key;
        private final String label;
        private final boolean rangeVisible;
        private final boolean selectedLevelsVisible;

        private OverlayModeOption(
                String key,
                String label,
                boolean rangeVisible,
                boolean selectedLevelsVisible
        ) {
            this.key = key;
            this.label = label;
            this.rangeVisible = rangeVisible;
            this.selectedLevelsVisible = selectedLevelsVisible;
        }

        String key() {
            return key;
        }

        boolean rangeVisible() {
            return rangeVisible;
        }

        boolean selectedLevelsVisible() {
            return selectedLevelsVisible;
        }

        @Override
        public String toString() {
            return label;
        }
    }

    static final class OverlayPanelState {

        private final String modeKey;
        private final int levelRange;
        private final double opacityPercent;
        private final String selectedLevelsText;
        private final boolean rangeVisible;
        private final boolean selectedVisible;
        private final boolean controlsDisabled;
        private final String triggerText;

        private OverlayPanelState(
                String modeKey,
                int levelRange,
                double opacityPercent,
                String selectedLevelsText,
                boolean rangeVisible,
                boolean selectedVisible,
                boolean controlsDisabled,
                String triggerText
        ) {
            this.modeKey = modeKey;
            this.levelRange = levelRange;
            this.opacityPercent = opacityPercent;
            this.selectedLevelsText = selectedLevelsText;
            this.rangeVisible = rangeVisible;
            this.selectedVisible = selectedVisible;
            this.controlsDisabled = controlsDisabled;
            this.triggerText = triggerText;
        }

        static OverlayPanelState from(DungeonOverlaySettings settings, boolean disabled) {
            DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
            String safeModeKey = normalizeModeKey(safeSettings.modeKey());
            return new OverlayPanelState(
                    safeModeKey,
                    boundedOverlayRange(safeSettings),
                    boundedOverlayOpacity(safeSettings) * 100.0,
                    selectedLevelList(safeSettings.selectedLevels()),
                    rangeMode(safeModeKey),
                    selectedLevelsMode(safeModeKey),
                    disabled,
                    triggerSummary(safeSettings));
        }

        String modeKey() {
            return modeKey;
        }

        int levelRange() {
            return levelRange;
        }

        double opacityPercent() {
            return opacityPercent;
        }

        String selectedLevelsText() {
            return selectedLevelsText;
        }

        boolean rangeVisible() {
            return rangeVisible;
        }

        boolean selectedVisible() {
            return selectedVisible;
        }

        String triggerText() {
            return triggerText;
        }

        boolean rangeDisabled() {
            return controlsDisabled || !rangeVisible;
        }

        boolean selectedLevelsDisabled() {
            return controlsDisabled || !selectedVisible;
        }
    }

    private static String triggerSummary(DungeonOverlaySettings settings) {
        DungeonOverlaySettings resolvedSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        String percentText = opacityText(boundedOverlayOpacity(resolvedSettings));
        String mode = normalizeModeKey(resolvedSettings.modeKey());
        if (overlayNearbyMode().equals(mode)) {
            return "Overlay: Nachbarn +/-" + boundedOverlayRange(resolvedSettings) + " " + percentText;
        }
        if (overlaySelectedMode().equals(mode)) {
            return "Overlay: Auswahl z="
                    + selectedLevelSummary(resolvedSettings.selectedLevels()) + " " + percentText;
        }
        return "Overlay: Aus";
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

    private static int boundedOverlayRange(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(1, safeSettings.levelRange());
    }

    private static double boundedOverlayOpacity(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
    }

    private static String normalizeModeKey(@Nullable String modeKey) {
        if (overlayNearbyMode().equalsIgnoreCase(modeKey)) {
            return overlayNearbyMode();
        }
        if (overlaySelectedMode().equalsIgnoreCase(modeKey)) {
            return overlaySelectedMode();
        }
        return overlayOffMode();
    }

    private static boolean rangeMode(String modeKey) {
        return overlayNearbyMode().equals(normalizeModeKey(modeKey));
    }

    private static boolean selectedLevelsMode(String modeKey) {
        return overlaySelectedMode().equals(normalizeModeKey(modeKey));
    }

    private static String overlayOffMode() {
        return "OFF";
    }

    private static String overlayNearbyMode() {
        return "NEARBY";
    }

    private static String overlaySelectedMode() {
        return "SELECTED";
    }
}
