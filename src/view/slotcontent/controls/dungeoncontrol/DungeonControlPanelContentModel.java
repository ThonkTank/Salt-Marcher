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
                formatLevels(current.selectedLevels()));
    }

    public static String summaryText(OverlaySettings settings) {
        OverlaySettings resolved = settings == null ? OverlaySettings.defaults() : settings;
        return switch (resolved.mode()) {
            case OFF -> "Overlay: Aus";
            case NEARBY -> "Overlay: Nachbarn +/-" + resolved.levelRange()
                    + " " + percentageText(resolved.opacity());
            case SELECTED -> "Overlay: Auswahl z=" + levelsSummary(resolved.selectedLevels())
                    + " " + percentageText(resolved.opacity());
        };
    }

    public static String formatLevels(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .sorted(Comparator.comparingInt(Integer::parseInt))
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    public static Optional<List<Integer>> parseLevels(String raw) {
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

        public boolean usesRange() {
            return this == NEARBY;
        }

        public boolean usesSelectedLevels() {
            return this == SELECTED;
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
}
