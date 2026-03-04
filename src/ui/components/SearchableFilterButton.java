package ui.components;

import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Compact filter button that opens a searchable checkbox popup on click.
 * Replaces the old TitledPane-based CheckboxFilterSection.
 */
public class SearchableFilterButton extends VBox {

    /** Lists with more options than this threshold get a search field to filter. */
    private static final int SEARCH_FIELD_THRESHOLD = 6;

    private final String label;
    private final Button trigger;
    private final Popup popup;
    private final List<CheckBox> checkboxes = new ArrayList<>();
    private final Consumer<List<String>> onChange;

    public SearchableFilterButton(String label, List<String> options,
                                  Consumer<List<String>> onChange) {
        this.label = label;
        this.onChange = onChange;

        trigger = new Button(label + " \u25BE");
        trigger.getStyleClass().addAll("compact", "filter-trigger");
        trigger.setOnAction(e -> togglePopup());

        // Popup content
        VBox popupContent = new VBox(4);
        popupContent.getStyleClass().add("filter-dropdown");
        popupContent.setPadding(new Insets(8));

        // Search field (only for lists with more options than threshold)
        TextField searchField = null;
        if (options.size() > SEARCH_FIELD_THRESHOLD) {
            searchField = new TextField();
            searchField.setPromptText(label + " suchen...");
            searchField.getStyleClass().add("quick-search-field");
            final TextField sf = searchField;
            searchField.textProperty().addListener((obs, o, n) -> filterCheckboxes(sf.getText()));
            popupContent.getChildren().add(searchField);
        }

        VBox checkboxList = new VBox(2);
        for (String option : options) {
            CheckBox cb = new CheckBox(option);
            cb.setOnAction(e -> {
                updateTriggerText();
                if (onChange != null) onChange.accept(getSelectedValues());
            });
            checkboxes.add(cb);
            checkboxList.getChildren().add(cb);
        }

        ScrollPane scroll = new ScrollPane(checkboxList);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scroll.setMaxHeight(280);
        scroll.setPrefWidth(200);
        scroll.setMinWidth(160);

        popupContent.getChildren().add(scroll);

        popup = new Popup();
        popup.setAutoHide(true);
        popup.getContent().add(popupContent);

        // Keyboard: focus search field (or popup itself) on show so Tab stays inside.
        // Escape closes the popup from both the content and the scroll container.
        final TextField focusTarget = searchField;
        popup.setOnShown(e -> javafx.application.Platform.runLater(() -> {
            if (focusTarget != null) focusTarget.requestFocus();
            else popupContent.requestFocus();
        }));
        popupContent.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                trigger.requestFocus();
                e.consume();
            }
        });
        scroll.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                trigger.requestFocus();
                e.consume();
            }
        });

        getChildren().add(trigger);
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
        } else {
            Bounds bounds = trigger.localToScreen(trigger.getBoundsInLocal());
            if (bounds != null) {
                popup.show(trigger, bounds.getMinX(), bounds.getMaxY() + 2);
            }
        }
    }

    private void filterCheckboxes(String query) {
        String lower = query.trim().toLowerCase();
        for (CheckBox cb : checkboxes) {
            boolean match = lower.isEmpty() || cb.getText().toLowerCase().contains(lower);
            cb.setVisible(match);
            cb.setManaged(match);
        }
    }

    private void updateTriggerText() {
        long count = checkboxes.stream().filter(CheckBox::isSelected).count();
        if (count > 0) {
            trigger.setText(label + " (" + count + ") \u25BE");
            if (!trigger.getStyleClass().contains("filter-trigger-active")) {
                trigger.getStyleClass().add("filter-trigger-active");
            }
        } else {
            trigger.setText(label + " \u25BE");
            trigger.getStyleClass().remove("filter-trigger-active");
        }
    }

    public List<String> getSelectedValues() {
        List<String> selected = new ArrayList<>();
        for (CheckBox cb : checkboxes) {
            if (cb.isSelected()) selected.add(cb.getText());
        }
        return selected;
    }

    public void removeValue(String value) {
        for (CheckBox cb : checkboxes) {
            if (cb.getText().equals(value)) {
                cb.setSelected(false);
                updateTriggerText();
                return;
            }
        }
    }

    public void clearSelection() {
        for (CheckBox cb : checkboxes) {
            cb.setSelected(false);
        }
        updateTriggerText();
    }
}
