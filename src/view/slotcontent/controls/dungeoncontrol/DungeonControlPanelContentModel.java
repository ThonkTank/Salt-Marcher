package src.view.slotcontent.controls.dungeoncontrol;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class DungeonControlPanelContentModel {

    private final ReadOnlyObjectWrapper<OverlaySettings> overlaySettings =
            new ReadOnlyObjectWrapper<>(OverlaySettings.defaults());
    private final ReadOnlyBooleanWrapper overlayDisabled = new ReadOnlyBooleanWrapper(false);

    public ReadOnlyObjectProperty<OverlaySettings> overlaySettingsProperty() {
        return overlaySettings.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty overlayDisabledProperty() {
        return overlayDisabled.getReadOnlyProperty();
    }

    public void showOverlaySettings(OverlaySettings settings, boolean disabled) {
        overlaySettings.set(settings == null ? OverlaySettings.defaults() : settings);
        overlayDisabled.set(disabled);
    }

    public OverlaySettings currentOverlaySettings() {
        return overlaySettings.get();
    }

    public boolean overlayDisabled() {
        return overlayDisabled.get();
    }

    public DungeonControlPanelViewInputEvent.OverlayInput currentOverlayInput() {
        OverlaySettings current = currentOverlaySettings();
        return new DungeonControlPanelViewInputEvent.OverlayInput(
                current.mode().name(),
                current.levelRange(),
                current.opacity(),
                OverlayText.formatLevels(current.selectedLevels()));
    }

    public OverlayPanelState currentOverlayPanelState() {
        return OverlayPanelState.from(currentOverlaySettings(), overlayDisabled());
    }

    public String normalizeSelectedLevelsDraft(String raw, List<Integer> fallbackLevels) {
        return parseLevels(raw)
                .map(OverlayText::formatLevels)
                .orElseGet(() -> OverlayText.formatLevels(fallbackLevels));
    }

    public Optional<List<Integer>> parseLevels(String raw) {
        return OverlayText.parseLevels(raw);
    }

    public String modeName(Mode mode) {
        return Mode.safe(mode).name();
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

        private static Optional<List<Integer>> parseLevels(String raw) {
            if (raw == null || raw.isBlank()) {
                return Optional.of(List.of());
            }
            try {
                return Optional.of(Arrays.stream(raw.split(","))
                        .map(String::trim)
                        .filter(part -> !part.isBlank())
                        .map(Integer::parseInt)
                        .sorted()
                        .distinct()
                        .toList());
            } catch (NumberFormatException exception) {
                return Optional.empty();
            }
        }

        private static String levelsSummary(List<Integer> levels) {
            String formatted = formatLevels(levels);
            return formatted.isBlank() ? "-" : formatted;
        }

        private static String percentageText(double opacity) {
            return Math.round(opacity * 100.0) + "%";
        }
    }

    public enum Mode {
        OFF("Aus"),
        NEARBY("Nahe Ebenen"),
        SELECTED("Auswahl");

        private final String label;

        Mode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }

        @Override
        public String toString() {
            return label;
        }

        public boolean usesRange() {
            return this == NEARBY;
        }

        public boolean usesSelectedLevels() {
            return this == SELECTED;
        }

        public static Mode safe(Mode mode) {
            return mode == null ? OFF : mode;
        }
    }

    public record OverlaySettings(
            Mode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        public OverlaySettings {
            mode = mode == null ? Mode.OFF : mode;
            levelRange = Math.max(1, levelRange);
            opacity = Math.max(0.1, Math.min(0.9, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static OverlaySettings defaults() {
            return new OverlaySettings(Mode.OFF, 2, 0.35, List.of());
        }
    }

    public record OverlayPanelState(
            Mode mode,
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
            Mode safeMode = Mode.safe(safeSettings.mode());
            boolean rangeVisible = safeMode.usesRange();
            boolean selectedVisible = safeMode.usesSelectedLevels();
            return new OverlayPanelState(
                    safeMode,
                    safeSettings.levelRange(),
                    safeSettings.opacity() * 100.0,
                    OverlayText.formatLevels(safeSettings.selectedLevels()),
                    rangeVisible,
                    selectedVisible,
                    disabled,
                    OverlayText.summaryText(safeSettings));
        }

        public boolean rangeDisabled() {
            return controlsDisabled || !rangeVisible;
        }

        public boolean selectedLevelsDisabled() {
            return controlsDisabled || !selectedVisible;
        }
    }
}
