package ui.components;

import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.BiConsumer;

public class CrRangeSelector extends VBox {

    private final ComboBox<String> minCombo;
    private final ComboBox<String> maxCombo;
    private final List<String> crValues;
    private final BiConsumer<String, String> onChange;
    private boolean updating = false;

    public CrRangeSelector(List<String> crValues, BiConsumer<String, String> onChange) {
        this.onChange = onChange;
        this.crValues = crValues;

        setSpacing(4);

        Label titleLabel = new Label("Challenge Rating");
        titleLabel.getStyleClass().add("bold");

        HBox row = new HBox(4);
        Label minLabel = new Label("Min:");
        minLabel.getStyleClass().add("text-secondary");
        minLabel.setMinWidth(30);
        Label maxLabel = new Label("Max:");
        maxLabel.getStyleClass().add("text-secondary");
        maxLabel.setMinWidth(30);

        minCombo = new ComboBox<>(FXCollections.observableArrayList(crValues));
        maxCombo = new ComboBox<>(FXCollections.observableArrayList(crValues));
        minCombo.getSelectionModel().selectFirst();
        maxCombo.getSelectionModel().selectLast();
        HBox.setHgrow(minCombo, Priority.ALWAYS);
        HBox.setHgrow(maxCombo, Priority.ALWAYS);
        minCombo.setMaxWidth(Double.MAX_VALUE);
        maxCombo.setMaxWidth(Double.MAX_VALUE);

        minCombo.setOnAction(e -> onSelectionChanged());
        maxCombo.setOnAction(e -> onSelectionChanged());

        row.getChildren().addAll(minLabel, minCombo, maxLabel, maxCombo);
        getChildren().addAll(titleLabel, row);
    }

    private void onSelectionChanged() {
        if (updating) return;
        int minIdx = minCombo.getSelectionModel().getSelectedIndex();
        int maxIdx = maxCombo.getSelectionModel().getSelectedIndex();
        if (minIdx > maxIdx) {
            updating = true;
            maxCombo.getSelectionModel().select(minIdx);
            updating = false;
        }
        if (onChange != null) onChange.accept(getMinCr(), getMaxCr());
    }

    public String getMinCr() { return minCombo.getValue(); }
    public String getMaxCr() { return maxCombo.getValue(); }

    public void reset() {
        updating = true;
        minCombo.getSelectionModel().selectFirst();
        maxCombo.getSelectionModel().selectLast();
        updating = false;
    }
}
