package src.view.leftbartabs.catalog;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

final class CatalogEncounterTuningSection extends VBox {

    private static final int AUTO_LEVEL = -1;
    private static final double AUTO_AMOUNT = -1.0;
    private static final double DEFAULT_DIFFICULTY_SLIDER_VALUE = 2.0;
    private static final double DEFAULT_BALANCE_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_AMOUNT_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_DIVERSITY_SLIDER_VALUE = 3.0;
    private static final double MIN_ENDPOINT_VALUE = 1.0;
    private static final double MAX_DIVERSITY_ENDPOINT_VALUE = 4.0;
    private static final double MAX_BALANCE_ENDPOINT_VALUE = 5.0;
    private static final String AUTO_DIFFICULTY_KEY = "auto";
    private static final String EASY_DIFFICULTY_KEY = "easy";
    private static final String MEDIUM_DIFFICULTY_KEY = "medium";
    private static final String HARD_DIFFICULTY_KEY = "hard";
    private static final String DEADLY_DIFFICULTY_KEY = "deadly";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACTIVE = "active";
    private static final String DIFFICULTY_SLIDER_STYLE = "difficulty-slider";
    private static final String MAX_DIVERSITY_LABEL = "4";

    private final Map<Integer, String> difficultyPreviewLabels =
            new LinkedHashMap<>(defaultDifficultyPreviewLabels());
    private final Map<Integer, String> balancePreviewLabels =
            new LinkedHashMap<>(defaultBalancePreviewLabels());
    private final Map<Integer, String> amountPreviewLabels =
            new LinkedHashMap<>(defaultAmountPreviewLabels());
    private final Map<Integer, String> diversityPreviewLabels =
            new LinkedHashMap<>(defaultDiversityPreviewLabels());

    private final TuningControl difficultyControl;
    private final TuningControl balanceControl;
    private final TuningControl amountControl;
    private final TuningControl diversityControl;

    CatalogEncounterTuningSection(Runnable onDifficultyChanged, Runnable onTuningChanged) {
        difficultyControl = new TuningControl(
                "Schwierigkeit",
                1.0,
                4.0,
                DEFAULT_DIFFICULTY_SLIDER_VALUE,
                true,
                "Schwierigkeitsbereich des Encounters",
                new DifficultyTickLabelFormatter(),
                value -> previewLabel(difficultyPreviewLabels, value, difficultyLabel((int) Math.round(value))),
                1.0,
                onDifficultyChanged);
        balanceControl = new TuningControl(
                "Balance",
                1.0,
                5.0,
                DEFAULT_BALANCE_SLIDER_VALUE,
                true,
                "1: CR-Extreme bevorzugen, 5: CR-Durchschnitt bevorzugen",
                new EndpointTickLabelFormatter("Extreme", "Durchschnitt"),
                value -> previewLabel(balancePreviewLabels, value, balanceLabel((int) Math.round(value))),
                null,
                onTuningChanged);
        amountControl = new TuningControl(
                "Menge",
                1.0,
                5.0,
                DEFAULT_AMOUNT_SLIDER_VALUE,
                false,
                "1: Bosse bevorzugen, 5: Minions bevorzugen",
                new EndpointTickLabelFormatter("Boss", "Minions"),
                value -> previewLabel(amountPreviewLabels, value, amountLabel(value)),
                1.0,
                onTuningChanged);
        diversityControl = new TuningControl(
                "Diversität",
                1.0,
                4.0,
                DEFAULT_DIVERSITY_SLIDER_VALUE,
                true,
                "1: ein Statblock, 4: vier unterschiedliche Statblocks",
                new EndpointTickLabelFormatter("1", MAX_DIVERSITY_LABEL),
                value -> previewLabel(diversityPreviewLabels, value, diversityLabel((int) Math.round(value))),
                null,
                onTuningChanged);

        difficultyControl.addSliderStyleClass(DIFFICULTY_SLIDER_STYLE);

        HBox controlRow = new HBox(8, difficultyControl, balanceControl, amountControl, diversityControl);
        HBox.setHgrow(difficultyControl, Priority.ALWAYS);
        HBox.setHgrow(balanceControl, Priority.ALWAYS);
        HBox.setHgrow(amountControl, Priority.ALWAYS);
        HBox.setHgrow(diversityControl, Priority.ALWAYS);

        setMaxWidth(Double.MAX_VALUE);
        setPadding(new Insets(0, 4, 0, 4));
        getChildren().add(controlRow);
    }

    void setEncounterTuningPreview(EncounterTuningPreview preview) {
        EncounterTuningPreview safePreview = preview == null ? EncounterTuningPreview.empty() : preview;
        replacePreviewLabels(difficultyPreviewLabels, safePreview.difficultyLabels(), defaultDifficultyPreviewLabels());
        replacePreviewLabels(balancePreviewLabels, safePreview.balanceLabels(), defaultBalancePreviewLabels());
        replacePreviewLabels(amountPreviewLabels, safePreview.amountLabels(), defaultAmountPreviewLabels());
        replacePreviewLabels(diversityPreviewLabels, safePreview.diversityLabels(), defaultDiversityPreviewLabels());
        difficultyControl.refreshDisplay();
        balanceControl.refreshDisplay();
        amountControl.refreshDisplay();
        diversityControl.refreshDisplay();
    }

    void applyEncounterBuilderInputs(String difficultyKey, EncounterTuningSelection tuning) {
        EncounterTuningSelection safeTuning = tuning == null
                ? EncounterTuningSelection.autoSelection()
                : tuning;
        difficultyControl.setAutoValue(
                isAutoDifficulty(difficultyKey),
                difficultySliderValue(difficultyKey));
        balanceControl.setAutoValue(
                safeTuning.balanceLevel() == AUTO_LEVEL,
                safeTuning.balanceLevel() == AUTO_LEVEL ? DEFAULT_BALANCE_SLIDER_VALUE : safeTuning.balanceLevel());
        amountControl.setAutoValue(
                safeTuning.amountValue() == AUTO_AMOUNT,
                safeTuning.amountValue() == AUTO_AMOUNT ? DEFAULT_AMOUNT_SLIDER_VALUE : safeTuning.amountValue());
        diversityControl.setAutoValue(
                safeTuning.diversityLevel() == AUTO_LEVEL,
                safeTuning.diversityLevel() == AUTO_LEVEL ? DEFAULT_DIVERSITY_SLIDER_VALUE : safeTuning.diversityLevel());
    }

    String difficultyKey() {
        return difficultyControl.isAuto()
                ? AUTO_DIFFICULTY_KEY
                : difficultyKey((int) Math.round(difficultyControl.rawValue()));
    }

    CatalogControlsViewInputEvent.EncounterTuning toInputEventTuning() {
        return new CatalogControlsViewInputEvent.EncounterTuning(
                balanceControl.isAuto() ? AUTO_LEVEL : (int) Math.round(balanceControl.rawValue()),
                amountControl.isAuto() ? AUTO_AMOUNT : amountControl.rawValue(),
                diversityControl.isAuto() ? AUTO_LEVEL : (int) Math.round(diversityControl.rawValue()));
    }

    private static boolean isAutoDifficulty(@Nullable String value) {
        return value == null || value.isBlank() || AUTO_DIFFICULTY_KEY.equalsIgnoreCase(value);
    }

    private static double difficultySliderValue(@Nullable String value) {
        if (value == null) {
            return DEFAULT_DIFFICULTY_SLIDER_VALUE;
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case EASY_DIFFICULTY_KEY -> 1.0;
            case HARD_DIFFICULTY_KEY -> 3.0;
            case DEADLY_DIFFICULTY_KEY -> 4.0;
            default -> DEFAULT_DIFFICULTY_SLIDER_VALUE;
        };
    }

    private static String difficultyKey(int value) {
        return switch (Math.max(1, Math.min(4, value))) {
            case 1 -> EASY_DIFFICULTY_KEY;
            case 3 -> HARD_DIFFICULTY_KEY;
            case 4 -> DEADLY_DIFFICULTY_KEY;
            default -> MEDIUM_DIFFICULTY_KEY;
        };
    }

    private static String difficultyLabel(int value) {
        return switch (Math.max(1, Math.min(4, value))) {
            case 1 -> "Easy";
            case 3 -> "Hard";
            case 4 -> "Deadly";
            default -> "Medium";
        };
    }

    private static String diversityLabel(int value) {
        int rounded = Math.max(1, Math.min(4, value));
        return rounded == 1 ? "1 Typ" : rounded + " Typen";
    }

    private static String amountLabel(double value) {
        int rounded = Math.max(1, Math.min(5, (int) Math.round(value)));
        return switch (rounded) {
            case 1 -> "Boss++";
            case 2 -> "Boss+";
            case 3 -> "Ausgeglichen";
            case 4 -> "Minions+";
            default -> "Minions++";
        };
    }

    private static String balanceLabel(int value) {
        return switch (Math.max(1, Math.min(5, value))) {
            case 1 -> "Extreme++";
            case 2 -> "Extreme+";
            case 3 -> "Neutral";
            case 4 -> "Durchschnitt+";
            default -> "Durchschnitt++";
        };
    }

    private static String previewLabel(Map<Integer, String> labels, double value, String fallback) {
        String label = labels.get((int) Math.round(value));
        return label == null || label.isBlank() ? fallback : label;
    }

    private static void replacePreviewLabels(
            Map<Integer, String> target,
            List<SliderPreviewLabel> labels,
            Map<Integer, String> fallback
    ) {
        target.clear();
        target.putAll(fallback);
        if (labels == null || labels.isEmpty()) {
            return;
        }
        for (SliderPreviewLabel label : labels) {
            if (label == null || label.label().isBlank()) {
                continue;
            }
            target.put((int) Math.round(label.value()), label.label());
        }
    }

    private static Map<Integer, String> defaultDifficultyPreviewLabels() {
        return Map.of(
                1, "25-49 XP",
                2, "50-74 XP",
                3, "75-99 XP",
                4, "100-125 XP");
    }

    private static Map<Integer, String> defaultBalancePreviewLabels() {
        return Map.of(
                1, "Extreme++",
                2, "Extreme+",
                3, "Neutral",
                4, "Durchschnitt+",
                5, "Durchschnitt++");
    }

    private static Map<Integer, String> defaultAmountPreviewLabels() {
        return Map.of(
                1, "Boss++",
                2, "Boss+",
                3, "Ausgeglichen",
                4, "Minions+",
                5, "Minions++");
    }

    private static Map<Integer, String> defaultDiversityPreviewLabels() {
        return Map.of(
                1, "1 Typ",
                2, "2 Typen",
                3, "3 Typen",
                4, "4 Typen");
    }

    record EncounterTuningSelection(int balanceLevel, double amountValue, int diversityLevel) {
        static EncounterTuningSelection autoSelection() {
            return new EncounterTuningSelection(AUTO_LEVEL, AUTO_AMOUNT, AUTO_LEVEL);
        }
    }

    record SliderPreviewLabel(double value, String label) {
        SliderPreviewLabel {
            label = label == null ? "" : label;
        }
    }

    record EncounterTuningPreview(
            List<SliderPreviewLabel> difficultyLabels,
            List<SliderPreviewLabel> balanceLabels,
            List<SliderPreviewLabel> amountLabels,
            List<SliderPreviewLabel> diversityLabels
    ) {
        EncounterTuningPreview {
            difficultyLabels = copyPreviewLabels(difficultyLabels);
            balanceLabels = copyPreviewLabels(balanceLabels);
            amountLabels = copyPreviewLabels(amountLabels);
            diversityLabels = copyPreviewLabels(diversityLabels);
        }

        @Override
        public List<SliderPreviewLabel> difficultyLabels() {
            return copyPreviewLabels(difficultyLabels);
        }

        @Override
        public List<SliderPreviewLabel> balanceLabels() {
            return copyPreviewLabels(balanceLabels);
        }

        @Override
        public List<SliderPreviewLabel> amountLabels() {
            return copyPreviewLabels(amountLabels);
        }

        @Override
        public List<SliderPreviewLabel> diversityLabels() {
            return copyPreviewLabels(diversityLabels);
        }

        static EncounterTuningPreview empty() {
            return new EncounterTuningPreview(List.of(), List.of(), List.of(), List.of());
        }
    }

    private static List<SliderPreviewLabel> copyPreviewLabels(List<SliderPreviewLabel> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static final class TuningControl extends HBox {

        private final Slider slider;
        private final Button autoButton;
        private final Label valueLabel;
        private final Function<Double, String> valueLabelFormatter;
        private final Runnable onChange;

        private boolean autoMode = true;
        private int internalUpdateDepth;

        TuningControl(
                String title,
                double min,
                double max,
                double defaultValue,
                boolean snapToTicks,
                String tooltip,
                StringConverter<Double> labelFormatter,
                Function<Double, String> valueLabelFormatter,
                @Nullable Double majorTickUnitOverride,
                Runnable onChange
        ) {
            setSpacing(4);
            setAlignment(Pos.CENTER_LEFT);
            this.valueLabelFormatter = valueLabelFormatter;
            this.onChange = onChange;

            Label titleLabel = new Label(title);
            titleLabel.getStyleClass().add(STYLE_TEXT_MUTED);
            titleLabel.setMinWidth(Region.USE_PREF_SIZE);

            autoButton = new Button("⚅");
            autoButton.getStyleClass().addAll(STYLE_COMPACT, "auto-dice-btn", STYLE_ACTIVE);
            autoButton.setMinWidth(Region.USE_PREF_SIZE);
            autoButton.setAccessibleText(title + " automatisch bestimmen");

            valueLabel = new Label();
            valueLabel.getStyleClass().add(STYLE_TEXT_SECONDARY);
            valueLabel.setMinWidth(56);
            valueLabel.setPrefWidth(56);

            slider = new Slider(min, max, defaultValue);
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            configureSliderTicks(snapToTicks, majorTickUnitOverride, max, min);
            if (labelFormatter != null) {
                slider.setLabelFormatter(labelFormatter);
            }
            slider.setDisable(true);
            slider.setAccessibleRoleDescription(title);
            slider.setAccessibleText(tooltip);
            HBox.setHgrow(slider, Priority.ALWAYS);

            autoButton.setOnAction(event -> toggleAutoMode());
            slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                updateValueLabel();
                fireChangedIfInteractive();
            });
            updateAutoButtonState();
            updateValueLabel();

            getChildren().addAll(titleLabel, autoButton, valueLabel, slider);
        }

        boolean isAuto() {
            return autoMode;
        }

        double rawValue() {
            return slider.getValue();
        }

        void setAutoValue(boolean auto, double value) {
            runInternalUpdate(() -> {
                autoMode = auto;
                slider.setValue(value);
                slider.setDisable(autoMode);
                updateAutoButtonState();
                updateValueLabel();
            });
        }

        void addSliderStyleClass(String styleClass) {
            if (styleClass != null && !styleClass.isBlank() && !slider.getStyleClass().contains(styleClass)) {
                slider.getStyleClass().add(styleClass);
            }
        }

        void refreshDisplay() {
            updateValueLabel();
        }

        private void configureSliderTicks(
                boolean snapToTicks,
                @Nullable Double majorTickUnitOverride,
                double max,
                double min
        ) {
            if (snapToTicks) {
                slider.setSnapToTicks(true);
                slider.setMajorTickUnit(1);
                slider.setMinorTickCount(0);
                return;
            }
            slider.setMajorTickUnit(majorTickUnitOverride != null ? majorTickUnitOverride : (max - min) / 3);
        }

        private void toggleAutoMode() {
            autoMode = !autoMode;
            slider.setDisable(autoMode);
            updateAutoButtonState();
            updateValueLabel();
            fireChangedIfInteractive();
        }

        private void updateValueLabel() {
            if (autoMode) {
                valueLabel.setText("");
                return;
            }
            valueLabel.setText(valueLabelFormatter == null ? "" : valueLabelFormatter.apply(slider.getValue()));
        }

        private void updateAutoButtonState() {
            autoButton.getStyleClass().remove(STYLE_ACTIVE);
            if (autoMode) {
                autoButton.getStyleClass().add(STYLE_ACTIVE);
            }
        }

        private void fireChangedIfInteractive() {
            if (!isInternalUpdate() && onChange != null) {
                onChange.run();
            }
        }

        private void runInternalUpdate(Runnable action) {
            internalUpdateDepth++;
            try {
                action.run();
            } finally {
                internalUpdateDepth--;
            }
        }

        private boolean isInternalUpdate() {
            return internalUpdateDepth > 0;
        }
    }

    private static final class DifficultyTickLabelFormatter extends StringConverter<Double> {
        @Override
        public String toString(Double value) {
            return difficultyLabel(value == null ? 2 : (int) Math.round(value));
        }

        @Override
        public Double fromString(String value) {
            return 0.0;
        }
    }

    private static final class EndpointTickLabelFormatter extends StringConverter<Double> {

        private final String minimumLabel;
        private final String maximumLabel;

        EndpointTickLabelFormatter(String minimumLabel, String maximumLabel) {
            this.minimumLabel = minimumLabel;
            this.maximumLabel = maximumLabel;
        }

        @Override
        public String toString(Double value) {
            if (value == null) {
                return "";
            }
            if (value <= MIN_ENDPOINT_VALUE) {
                return minimumLabel;
            }
            if (MAX_DIVERSITY_LABEL.equals(maximumLabel) && value >= MAX_DIVERSITY_ENDPOINT_VALUE) {
                return maximumLabel;
            }
            if (value >= MAX_BALANCE_ENDPOINT_VALUE) {
                return maximumLabel;
            }
            return "";
        }

        @Override
        public Double fromString(String value) {
            return 0.0;
        }
    }
}
