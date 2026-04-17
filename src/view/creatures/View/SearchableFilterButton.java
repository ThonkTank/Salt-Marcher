package src.view.creatures.View;

import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

final class SearchableFilterButton extends Button {

    private static final int SEARCH_FIELD_THRESHOLD = 6;

    private final String label;
    private final Popup popup;
    private final List<CheckBox> checkboxes = new ArrayList<>();
    private final Runnable onChange;

    SearchableFilterButton(String label, List<String> options, List<String> selectedValues, Runnable onChange) {
        this.label = Objects.requireNonNull(label, "label");
        this.onChange = onChange;

        setText(label + " \u25BE");
        getStyleClass().addAll("compact", "filter-trigger");
        setAccessibleText(label + " geschlossen");
        setOnAction(event -> togglePopup());

        VBox popupContent = new VBox(4);
        popupContent.getStyleClass().add("filter-dropdown");
        popupContent.setPadding(new Insets(8));

        TextField searchField = null;
        if (options.size() > SEARCH_FIELD_THRESHOLD) {
            searchField = new TextField();
            searchField.setPromptText(label + " suchen...");
            searchField.getStyleClass().add("quick-search-field");
            TextField focusTarget = searchField;
            searchField.textProperty().addListener((ignored, before, after) -> filterCheckboxes(focusTarget.getText()));
            popupContent.getChildren().add(searchField);
        }

        VBox checkboxList = new VBox(2);
        for (String option : options) {
            CheckBox checkbox = new CheckBox(option);
            checkbox.setSelected(selectedValues.contains(option));
            checkbox.setOnAction(event -> {
                updateTriggerText();
                if (this.onChange != null) {
                    this.onChange.run();
                }
            });
            checkboxes.add(checkbox);
            checkboxList.getChildren().add(checkbox);
        }

        ScrollPane scrollPane = new ScrollPane(checkboxList);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setMaxHeight(280);
        scrollPane.setPrefWidth(200);
        scrollPane.setMinWidth(160);
        popupContent.getChildren().add(scrollPane);

        popup = new Popup();
        popup.setAutoHide(true);
        popup.getContent().add(popupContent);

        TextField focusTarget = searchField;
        popup.setOnShown(event -> javafx.application.Platform.runLater(() -> {
            if (focusTarget != null) {
                focusTarget.requestFocus();
            } else {
                popupContent.requestFocus();
            }
        }));
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                requestFocus();
                event.consume();
                return;
            }
            if (event.getCode() == KeyCode.TAB) {
                javafx.application.Platform.runLater(() -> {
                    if (!popup.isShowing()) {
                        return;
                    }
                    javafx.scene.Scene popupScene = popup.getScene();
                    if (popupScene == null || popupScene.getFocusOwner() == null) {
                        popup.hide();
                        setAccessibleText(label + " geschlossen");
                        requestFocus();
                    }
                });
            }
        });
        updateTriggerText();
    }

    List<String> selectedValues() {
        List<String> selected = new ArrayList<>();
        for (CheckBox checkbox : checkboxes) {
            if (checkbox.isSelected()) {
                selected.add(checkbox.getText());
            }
        }
        return selected;
    }

    void removeValue(String value) {
        for (CheckBox checkbox : checkboxes) {
            if (checkbox.getText().equals(value)) {
                checkbox.setSelected(false);
                updateTriggerText();
                return;
            }
        }
    }

    void clearSelection() {
        for (CheckBox checkbox : checkboxes) {
            checkbox.setSelected(false);
        }
        updateTriggerText();
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            setAccessibleText(label + " geschlossen");
            return;
        }
        Bounds bounds = localToScreen(getBoundsInLocal());
        if (bounds == null) {
            return;
        }
        popup.show(this, bounds.getMinX(), bounds.getMaxY() + 2);
        setAccessibleText(label + " geöffnet – Escape zum Schließen");
    }

    private void filterCheckboxes(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        for (CheckBox checkbox : checkboxes) {
            boolean matches = normalized.isEmpty()
                    || checkbox.getText().toLowerCase(Locale.ROOT).contains(normalized);
            checkbox.setVisible(matches);
            checkbox.setManaged(matches);
        }
    }

    private void updateTriggerText() {
        long selectedCount = checkboxes.stream().filter(CheckBox::isSelected).count();
        getStyleClass().remove("filter-trigger-active");
        if (selectedCount > 0) {
            setText(label + " (" + selectedCount + ") \u25BE");
            getStyleClass().add("filter-trigger-active");
        } else {
            setText(label + " \u25BE");
        }
        if (!popup.isShowing()) {
            setAccessibleText(getText());
        }
    }
}
