package src.view.leftbartabs.catalog;

import java.util.List;
import javafx.collections.FXCollections;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;

final class CatalogCrRangeView extends HBox {

    private static final String DEFAULT_MINIMUM = "0";
    private static final String DEFAULT_MAXIMUM = "30";

    private final EndpointSelector minimum = new EndpointSelector("Minimaler CR");
    private final EndpointSelector maximum = new EndpointSelector("Maximaler CR");
    private final Runnable onInteraction;

    CatalogCrRangeView(Runnable onInteraction) {
        super(2);
        this.onInteraction = onInteraction;
        minimum.setOnAction(event -> publishSelection());
        maximum.setOnAction(event -> publishSelection());
        getChildren().setAll(new CrLabel(), minimum, new MutedLabel("-"), maximum);
    }

    void setValues(List<String> values) {
        List<String> safeValues = values == null || values.isEmpty()
                ? List.of(DEFAULT_MINIMUM, DEFAULT_MAXIMUM)
                : List.copyOf(values);
        minimum.setValues(safeValues);
        maximum.setValues(safeValues);
        minimum.selectFallback(true);
        maximum.selectFallback(false);
    }

    void applySelection(String minimumValue, String maximumValue) {
        minimum.selectValue(minimumValue, true);
        maximum.selectValue(maximumValue, false);
        maximum.ensureAtLeast(minimum.selectedIndex());
    }

    Selection snapshot() {
        return new Selection(minimum.minimumValue(), maximum.maximumValue());
    }

    void reset() {
        minimum.selectFallback(true);
        maximum.selectFallback(false);
    }

    record Selection(String minimumValue, String maximumValue) {
    }

    private void publishSelection() {
        maximum.ensureAtLeast(minimum.selectedIndex());
        if (onInteraction != null) {
            onInteraction.run();
        }
    }

    private static final class EndpointSelector extends ComboBox<String> {

        EndpointSelector(String accessibleText) {
            setAccessibleText(accessibleText);
            setPrefWidth(65);
        }

        void setValues(List<String> values) {
            setItems(FXCollections.observableArrayList(values));
        }

        void selectValue(String value, boolean first) {
            if (value == null || value.isBlank()) {
                selectFallback(first);
                return;
            }
            int index = getItems().indexOf(value);
            if (index >= 0) {
                getSelectionModel().clearAndSelect(index);
                return;
            }
            selectFallback(first);
        }

        void selectFallback(boolean first) {
            getSelectionModel().clearAndSelect(first ? 0 : Math.max(getItems().size() - 1, 0));
        }

        int selectedIndex() {
            return getSelectionModel().getSelectedIndex();
        }

        void ensureAtLeast(int minimumIndex) {
            if (minimumIndex > selectedIndex() && minimumIndex >= 0) {
                getSelectionModel().select(minimumIndex);
            }
        }

        String minimumValue() {
            return selectedIndex() > 0 ? selectedValue() : "";
        }

        String maximumValue() {
            int lastIndex = getItems().size() - 1;
            return selectedIndex() >= 0 && selectedIndex() < lastIndex ? selectedValue() : "";
        }

        private String selectedValue() {
            String value = getValue();
            return value == null ? "" : value;
        }
    }

    private static final class CrLabel extends Label {

        CrLabel() {
            super("CR");
            getStyleClass().addAll("text-muted", "bold");
            setMinWidth(20);
        }
    }

    private static final class MutedLabel extends Label {

        MutedLabel(String text) {
            super(text);
            getStyleClass().add("text-muted");
        }
    }
}
