package ui.components;

import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.util.StringConverter;

import java.util.function.Function;

/**
 * Labeled slider with an optional "Auto" checkbox.
 * When Auto is checked, {@link #getValue()} returns {@link #AUTO_VALUE} (-1.0),
 * signalling callers to use a default/random strategy. When unchecked, the slider
 * is enabled and {@code getValue()} returns the slider's current position.
 */
public class SliderControl extends HBox {

    /** Returned by getValue() when the slider is in Auto mode. */
    public static final double AUTO_VALUE = -1.0;

    private final Slider slider;
    private final Button autoButton;
    private final Label valueLabel;
    private final Function<Double, String> valueLabelFormatter;
    private boolean autoMode = true;

    public SliderControl(String title, double min, double max, double defaultVal,
                         boolean snapToTicks, String tooltip,
                         StringConverter<Double> labelFormatter,
                         Function<Double, String> valueLabelFormatter) {
        this(title, min, max, defaultVal, snapToTicks, tooltip,
                labelFormatter, valueLabelFormatter, null);
    }

    public SliderControl(String title, double min, double max, double defaultVal,
                         boolean snapToTicks, String tooltip,
                         StringConverter<Double> labelFormatter,
                         Function<Double, String> valueLabelFormatter,
                         Double majorTickUnitOverride) {
        setSpacing(4);
        setAlignment(Pos.CENTER_LEFT);
        this.valueLabelFormatter = valueLabelFormatter;

        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("text-muted");
        titleLabel.setMinWidth(Region.USE_PREF_SIZE);

        autoButton = new Button("\u2685");
        autoButton.getStyleClass().addAll("compact", "auto-dice-btn", "active");
        autoButton.setMinWidth(Region.USE_PREF_SIZE);
        autoButton.setAccessibleText(title + " automatisch bestimmen");

        valueLabel = new Label();
        valueLabel.getStyleClass().add("text-secondary");
        valueLabel.setMinWidth(56);
        valueLabel.setPrefWidth(56);

        slider = new Slider(min, max, defaultVal);
        slider.setShowTickLabels(true);
        slider.setShowTickMarks(true);
        if (snapToTicks) {
            slider.setSnapToTicks(true);
            slider.setMajorTickUnit(1);
            slider.setMinorTickCount(0);
        } else {
            slider.setMajorTickUnit(
                    majorTickUnitOverride != null ? majorTickUnitOverride : (max - min) / 3);
        }
        if (labelFormatter != null) slider.setLabelFormatter(labelFormatter);
        slider.setDisable(true);
        slider.setAccessibleRoleDescription(title);
        if (tooltip != null) slider.setAccessibleText(tooltip);
        HBox.setHgrow(slider, Priority.ALWAYS);

        autoButton.setOnAction(e -> {
            autoMode = !autoMode;
            slider.setDisable(autoMode);
            updateAutoButtonState();
            updateValueLabel(this.valueLabelFormatter);
        });
        slider.valueProperty().addListener((obs, o, n) -> updateValueLabel(this.valueLabelFormatter));
        updateAutoButtonState();
        updateValueLabel(this.valueLabelFormatter);

        getChildren().addAll(titleLabel, autoButton, valueLabel, slider);
    }

    private void updateValueLabel(Function<Double, String> formatter) {
        if (autoMode) {
            valueLabel.setText("");
        } else if (formatter != null) {
            valueLabel.setText(formatter.apply(slider.getValue()));
        }
    }

    private void updateAutoButtonState() {
        autoButton.getStyleClass().remove("active");
        if (autoMode) autoButton.getStyleClass().add("active");
    }

    public double getValue() { return autoMode ? AUTO_VALUE : slider.getValue(); }
    public boolean isAuto()  { return autoMode; }
    public void addSliderStyleClass(String styleClass) {
        if (styleClass != null && !styleClass.isBlank() && !slider.getStyleClass().contains(styleClass)) {
            slider.getStyleClass().add(styleClass);
        }
    }
    public void refreshDisplay() { updateValueLabel(valueLabelFormatter); }
}
