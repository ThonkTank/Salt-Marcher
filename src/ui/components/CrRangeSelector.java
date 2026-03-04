package ui.components;

import javafx.collections.FXCollections;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;

import java.util.List;
import java.util.function.BiConsumer;

public class CrRangeSelector extends HBox {

    private final ComboBox<String> minCombo;
    private final ComboBox<String> maxCombo;
    private final List<String> crValues;
    private final BiConsumer<String, String> onChange;
    private boolean updating = false;

    public CrRangeSelector(List<String> crValues, BiConsumer<String, String> onChange) {
        this.onChange = onChange;
        this.crValues = crValues;

        setSpacing(2);

        Label crLabel = new Label("CR");
        crLabel.getStyleClass().addAll("text-muted", "bold");
        crLabel.setMinWidth(20);

        minCombo = new ComboBox<>(FXCollections.observableArrayList(crValues));
        minCombo.setAccessibleText("Minimaler CR");
        maxCombo = new ComboBox<>(FXCollections.observableArrayList(crValues));
        maxCombo.setAccessibleText("Maximaler CR");
        minCombo.getSelectionModel().selectFirst();
        maxCombo.getSelectionModel().selectLast();
        minCombo.setPrefWidth(65);
        maxCombo.setPrefWidth(65);

        Label dash = new Label("-");
        dash.getStyleClass().add("text-muted");

        minCombo.setOnAction(e -> onSelectionChanged());
        maxCombo.setOnAction(e -> onSelectionChanged());

        getChildren().addAll(crLabel, minCombo, dash, maxCombo);
    }

    private void onSelectionChanged() {
        if (updating) return;
        int minIdx = minCombo.getSelectionModel().getSelectedIndex();
        int maxIdx = maxCombo.getSelectionModel().getSelectedIndex();
        if (minIdx > maxIdx) {
            // Suppress callback while adjusting the max value
            withSuppressedCallback(() -> maxCombo.getSelectionModel().select(minIdx));
        }
        if (onChange != null) onChange.accept(getMinCr(), getMaxCr());
    }

    /**
     * Executes an action while suppressing the onChange callback.
     * Prevents duplicate or cascading onChange events during programmatic selection changes.
     */
    private void withSuppressedCallback(Runnable action) {
        updating = true;
        try {
            action.run();
        } finally {
            updating = false;
        }
    }

    public String getMinCr() { return minCombo.getValue(); }
    public String getMaxCr() { return maxCombo.getValue(); }

    public void reset() {
        withSuppressedCallback(() -> {
            minCombo.getSelectionModel().selectFirst();
            maxCombo.getSelectionModel().selectLast();
        });
    }
}
