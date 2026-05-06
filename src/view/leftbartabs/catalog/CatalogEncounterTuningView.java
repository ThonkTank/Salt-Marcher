package src.view.leftbartabs.catalog;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

final class CatalogEncounterTuningView extends VBox {

    private static final double DEFAULT_DIFFICULTY_SLIDER_VALUE = 2.0;
    private static final double DEFAULT_BALANCE_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_AMOUNT_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_DIVERSITY_SLIDER_VALUE = 3.0;
    private static final double MINIMUM_ENDPOINT_LABEL_VALUE = 1.0;

    private final TuningControl difficultyControl;
    private final TuningControl balanceControl;
    private final TuningControl amountControl;
    private final TuningControl diversityControl;

    CatalogEncounterTuningView(Runnable onInteraction) {
        difficultyControl = new TuningControl(new ControlSpec(
                "Schwierigkeit",
                1.0,
                4.0,
                DEFAULT_DIFFICULTY_SLIDER_VALUE,
                true,
                "Schwierigkeitsbereich des Encounters",
                difficultyFormatter(),
                1.0,
                "difficulty-slider"), onInteraction);
        balanceControl = new TuningControl(new ControlSpec(
                "Balance",
                1.0,
                5.0,
                DEFAULT_BALANCE_SLIDER_VALUE,
                true,
                "1: CR-Extreme bevorzugen, 5: CR-Durchschnitt bevorzugen",
                endpointFormatter("Extreme", "Durchschnitt", 5.0),
                null,
                null), onInteraction);
        amountControl = new TuningControl(new ControlSpec(
                "Menge",
                1.0,
                5.0,
                DEFAULT_AMOUNT_SLIDER_VALUE,
                false,
                "1: Bosse bevorzugen, 5: Minions bevorzugen",
                endpointFormatter("Boss", "Minions", 5.0),
                1.0,
                null), onInteraction);
        diversityControl = new TuningControl(new ControlSpec(
                "Diversität",
                1.0,
                4.0,
                DEFAULT_DIVERSITY_SLIDER_VALUE,
                true,
                "1: ein Statblock, 4: vier unterschiedliche Statblocks",
                endpointFormatter("1", "4", 4.0),
                null,
                null), onInteraction);

        setMaxWidth(Double.MAX_VALUE);
        setPadding(new Insets(0, 4, 0, 4));
        getChildren().setAll(new ControlsRow(difficultyControl, balanceControl, amountControl, diversityControl));
    }

    void applyProjection(CatalogContributionModel.ControlsState state) {
        CatalogContributionModel.ControlsState safeState =
                state == null ? CatalogContributionModel.ControlsState.empty() : state;
        difficultyControl.applyProjection(safeState.difficulty());
        balanceControl.applyProjection(safeState.balance());
        amountControl.applyProjection(safeState.amount());
        diversityControl.applyProjection(safeState.diversity());
    }

    Snapshot snapshot() {
        return new Snapshot(
                difficultyControl.autoMode(),
                difficultyControl.value(),
                balanceControl.autoMode(),
                balanceControl.value(),
                amountControl.autoMode(),
                amountControl.value(),
                diversityControl.autoMode(),
                diversityControl.value());
    }

    record Snapshot(
            boolean difficultyAuto,
            double difficultyValue,
            boolean balanceAuto,
            double balanceValue,
            boolean amountAuto,
            double amountValue,
            boolean diversityAuto,
            double diversityValue
    ) {
    }

    private static StringConverter<Double> difficultyFormatter() {
        return new StringConverter<>() {
            @Override
            public String toString(Double value) {
                int roundedValue = value == null ? 2 : (int) Math.round(value);
                return switch (Math.max(1, Math.min(4, roundedValue))) {
                    case 1 -> "Easy";
                    case 3 -> "Hard";
                    case 4 -> "Deadly";
                    default -> "Medium";
                };
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        };
    }

    private static StringConverter<Double> endpointFormatter(String minimumLabel, String maximumLabel, double maximumValue) {
        return new StringConverter<>() {
            @Override
            public String toString(Double value) {
                if (value == null) {
                    return "";
                }
                if (value <= MINIMUM_ENDPOINT_LABEL_VALUE) {
                    return minimumLabel;
                }
                if (value >= maximumValue) {
                    return maximumLabel;
                }
                return "";
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        };
    }

    private static final class ControlsRow extends HBox {

        ControlsRow(TuningControl... controls) {
            super(8, controls);
            for (TuningControl control : controls) {
                setHgrow(control, Priority.ALWAYS);
            }
        }
    }

    private static final class TuningControl extends HBox {

        private final Map<Integer, String> previewLabels = new LinkedHashMap<>();
        private final Slider slider;
        private final AutoButton autoButton;
        private final ValueLabel valueLabel;
        private final Runnable onInteraction;
        private boolean autoMode = true;
        private boolean internalUpdate;

        TuningControl(ControlSpec spec, Runnable onInteraction) {
            super(4);
            setAlignment(Pos.CENTER_LEFT);
            this.onInteraction = onInteraction;

            slider = new TuningSlider(spec);
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            slider.setSnapToTicks(spec.snapToTicks());
            slider.setMajorTickUnit(spec.majorTickUnitOverride() == null ? 1.0 : spec.majorTickUnitOverride());
            slider.setMinorTickCount(0);
            slider.setLabelFormatter(spec.labelFormatter());
            slider.setDisable(true);
            slider.setAccessibleRoleDescription(spec.title());
            slider.setAccessibleText(spec.tooltip());
            setHgrow(slider, Priority.ALWAYS);

            autoButton = new AutoButton(spec.title());
            valueLabel = new ValueLabel();
            autoButton.setOnAction(event -> {
                autoMode = !autoMode;
                updateVisualState();
                if (!internalUpdate && onInteraction != null) {
                    onInteraction.run();
                }
            });
            slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                updateValueLabel();
                if (!internalUpdate && onInteraction != null) {
                    onInteraction.run();
                }
            });

            getChildren().setAll(new MutedLabel(spec.title()), autoButton, valueLabel, slider);
            updateVisualState();
        }

        void applyProjection(CatalogContributionModel.SliderProjection projection) {
            CatalogContributionModel.SliderProjection safeProjection = projection == null
                    ? new CatalogContributionModel.SliderProjection(true, slider.getValue(), List.of())
                    : projection;
            internalUpdate = true;
            try {
                replacePreviewLabels(safeProjection.labels());
                autoMode = safeProjection.auto();
                slider.setValue(safeProjection.value());
            } finally {
                internalUpdate = false;
            }
            updateVisualState();
        }

        boolean autoMode() {
            return autoMode;
        }

        double value() {
            return slider.getValue();
        }

        private void replacePreviewLabels(List<CatalogContributionModel.PreviewLabel> labels) {
            previewLabels.clear();
            if (labels == null) {
                return;
            }
            for (CatalogContributionModel.PreviewLabel label : labels) {
                if (label != null && !label.label().isBlank()) {
                    previewLabels.put((int) Math.round(label.value()), label.label());
                }
            }
        }

        private void updateVisualState() {
            slider.setDisable(autoMode);
            autoButton.update(autoMode);
            updateValueLabel();
        }

        private void updateValueLabel() {
            if (autoMode) {
                valueLabel.setText("");
                return;
            }
            valueLabel.setText(previewLabels.getOrDefault((int) Math.round(slider.getValue()), ""));
        }
    }

    private record ControlSpec(
            String title,
            double min,
            double max,
            double defaultValue,
            boolean snapToTicks,
            String tooltip,
            StringConverter<Double> labelFormatter,
            @Nullable Double majorTickUnitOverride,
            @Nullable String sliderStyleClass
    ) {
    }

    private static final class TuningSlider extends Slider {

        TuningSlider(ControlSpec spec) {
            super(spec.min(), spec.max(), spec.defaultValue());
            if (spec.sliderStyleClass() != null && !spec.sliderStyleClass().isBlank()) {
                getStyleClass().add(spec.sliderStyleClass());
            }
        }
    }

    private static final class MutedLabel extends Label {

        MutedLabel(String text) {
            super(text);
            getStyleClass().add("text-muted");
            setMinWidth(USE_PREF_SIZE);
        }
    }

    private static final class AutoButton extends Button {

        AutoButton(String title) {
            super("⚅");
            getStyleClass().addAll("compact", "auto-dice-btn", "active");
            setMinWidth(USE_PREF_SIZE);
            setAccessibleText(title + " automatisch bestimmen");
        }

        void update(boolean autoMode) {
            getStyleClass().remove("active");
            if (autoMode) {
                getStyleClass().add("active");
            }
        }
    }

    private static final class ValueLabel extends Label {

        ValueLabel() {
            getStyleClass().add("text-secondary");
            setMinWidth(56);
            setPrefWidth(56);
        }
    }
}
