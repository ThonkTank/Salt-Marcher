package ui.components;

import javafx.geometry.Pos;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.util.StringConverter;

import java.util.function.Function;

public class SliderControl extends HBox {

    private final Slider slider;
    private final CheckBox autoBox;
    private final Label valueLabel;

    public SliderControl(String title, double min, double max, double defaultVal,
                         boolean snapToTicks, String tooltip,
                         StringConverter<Double> labelFormatter,
                         Function<Double, String> valueLabelFormatter) {
        setSpacing(4);
        setAlignment(Pos.CENTER_LEFT);

        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("text-muted");
        titleLabel.setMinWidth(Region.USE_PREF_SIZE);

        autoBox = new CheckBox("Auto");
        autoBox.setSelected(true);
        autoBox.getStyleClass().add("small");
        autoBox.setMinWidth(Region.USE_PREF_SIZE);

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
            slider.setMajorTickUnit((max - min) / 3);
        }
        if (labelFormatter != null) slider.setLabelFormatter(labelFormatter);
        slider.setDisable(true);
        if (tooltip != null) slider.setAccessibleText(tooltip);
        HBox.setHgrow(slider, Priority.ALWAYS);

        autoBox.setOnAction(e -> {
            slider.setDisable(autoBox.isSelected());
            updateValueLabel(valueLabelFormatter);
        });
        slider.valueProperty().addListener((obs, o, n) -> updateValueLabel(valueLabelFormatter));
        updateValueLabel(valueLabelFormatter);

        getChildren().addAll(titleLabel, autoBox, valueLabel, slider);
    }

    private void updateValueLabel(Function<Double, String> formatter) {
        if (autoBox.isSelected()) {
            valueLabel.setText("");
        } else if (formatter != null) {
            valueLabel.setText(formatter.apply(slider.getValue()));
        }
    }

    public double getValue() { return autoBox.isSelected() ? -1 : slider.getValue(); }
    public boolean isAuto()  { return autoBox.isSelected(); }
    public Slider getSlider() { return slider; }

    public void setCompact(boolean compact) {
        valueLabel.setVisible(!compact);
        valueLabel.setManaged(!compact);
    }
}
