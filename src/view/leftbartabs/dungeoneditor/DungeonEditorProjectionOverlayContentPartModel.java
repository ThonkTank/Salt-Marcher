package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorProjectionOverlayContentPartModel {
    private static final String OVERLAY_OFF_MODE = "OFF";
    private static final String OVERLAY_NEARBY_MODE = "NEARBY";
    private static final String OVERLAY_SELECTED_MODE = "SELECTED";

    private final ReadOnlyObjectWrapper<DungeonEditorControlsContentModel.ProjectionState> projection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsContentModel.ProjectionState.initial());

    ReadOnlyObjectProperty<DungeonEditorControlsContentModel.ProjectionState> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void showProjection(
            List<Integer> reachableLevels,
            boolean busy,
            boolean hasMap,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            String viewMode
    ) {
        projection.set(new DungeonEditorControlsContentModel.ProjectionState(
                projectionLevel,
                busy,
                hasMap && !safeLevels(reachableLevels).isEmpty(),
                overlaySettings,
                DungeonEditorControlsContentModel.OverlayPanelState.from(overlaySettings, busy),
                busy,
                viewMode,
                DungeonEditorControlsContentModel.graphViewLabel().equals(
                        DungeonEditorControlsContentModel.normalizeViewModeKey(viewMode))));
    }

    List<DungeonEditorControlsContentModel.OverlayModeOption> overlayModeOptions() {
        return List.of(
                new DungeonEditorControlsContentModel.OverlayModeOption(overlayOffMode(), "Aus", false, false),
                new DungeonEditorControlsContentModel.OverlayModeOption(overlayNearbyMode(), "Nahe Ebenen", true, false),
                new DungeonEditorControlsContentModel.OverlayModeOption(
                        overlaySelectedMode(),
                        DungeonEditorControlsContentModel.defaultToolLabel(),
                        false,
                        true));
    }

    static DungeonEditorControlsContentModel.OverlayPanelState overlayPanelState(
            DungeonOverlaySettings settings,
            boolean disabled
    ) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        String modeKey = normalizeModeKey(safeSettings.modeKey());
        int levelRange = Math.max(1, safeSettings.levelRange());
        double opacity = Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
        String opacityText = opacityText(opacity);
        String selectedLevelsText = selectedLevelList(safeSettings.selectedLevels());
        return new DungeonEditorControlsContentModel.OverlayPanelState(
                modeKey,
                levelRange,
                opacity * 100.0,
                opacityText,
                selectedLevelsText,
                overlayNearbyMode().equals(modeKey),
                overlaySelectedMode().equals(modeKey),
                disabled,
                triggerText(modeKey, levelRange, opacityText, selectedLevelsText));
    }

    static String normalizeModeKey(@Nullable String modeKey) {
        if (overlayNearbyMode().equalsIgnoreCase(modeKey)) {
            return overlayNearbyMode();
        }
        if (overlaySelectedMode().equalsIgnoreCase(modeKey)) {
            return overlaySelectedMode();
        }
        return overlayOffMode();
    }

    static String overlayOffMode() {
        return OVERLAY_OFF_MODE;
    }

    static String overlayNearbyMode() {
        return OVERLAY_NEARBY_MODE;
    }

    static String overlaySelectedMode() {
        return OVERLAY_SELECTED_MODE;
    }

    private static List<Integer> safeLevels(List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
    }

    private static String opacityText(double opacity) {
        return Math.round(opacity * 100.0) + "%";
    }

    private static String triggerText(
            String modeKey,
            int levelRange,
            String opacityText,
            String selectedLevelsText
    ) {
        if (overlayNearbyMode().equals(modeKey)) {
            return "Overlay: Nachbarn +/-" + levelRange + " " + opacityText;
        }
        if (overlaySelectedMode().equals(modeKey)) {
            return "Overlay: Auswahl z=" + selectedLevelSummary(selectedLevelsText) + " " + opacityText;
        }
        return "Overlay: Aus";
    }

    private static String selectedLevelSummary(String selectedLevelsText) {
        return selectedLevelsText.isBlank() ? "-" : selectedLevelsText;
    }

    private static String selectedLevelList(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(", "));
    }
}
