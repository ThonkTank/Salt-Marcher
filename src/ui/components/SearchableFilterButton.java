package ui.components;

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
import java.util.function.Consumer;

/**
 * Compact filter button that opens a searchable checkbox popup on click.
 * Replaces the old TitledPane-based CheckboxFilterSection.
 *
 * <p>Extends {@code Button} so it participates directly in any container's node API.
 * The popup is not part of the scene graph — it is owned by a {@link javafx.stage.Popup}
 * that floats above the window.
 */
public class SearchableFilterButton extends Button {

    /** Lists with strictly more than this many options get a search field.
     *  Sizes has exactly 6 options (no field); Types has 14+ options (field shown). */
    private static final int SEARCH_FIELD_THRESHOLD = 6;

    private final String label;
    private final Popup popup;
    private final List<CheckBox> checkboxes = new ArrayList<>();
    private final Consumer<List<String>> onChange;

    public SearchableFilterButton(String label, List<String> options,
                                  Consumer<List<String>> onChange) {
        this.label = label;
        this.onChange = onChange;

        setText(label + " \u25BE");
        getStyleClass().addAll("compact", "filter-trigger");
        setAccessibleText(label + " geschlossen");
        setOnAction(e -> togglePopup());

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
        // Escape closes the popup from any focused child (event filter catches before bubbling).
        // Focus trap: hide popup when focus moves outside the popup content subtree.
        final TextField focusTarget = searchField;
        popup.setOnShown(e -> javafx.application.Platform.runLater(() -> {
            if (focusTarget != null) focusTarget.requestFocus();
            else popupContent.requestFocus();
        }));
        popup.addEventFilter(KeyEvent.KEY_PRESSED, e -> {
            if (e.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                requestFocus();
                e.consume();
            } else if (e.getCode() == KeyCode.TAB) {
                // After Tab navigates, check whether focus is still inside the popup.
                // If the popup scene has no focus owner, Tab moved focus to the main window
                // — close the popup so it does not remain visually open (WCAG 2.1.1).
                javafx.application.Platform.runLater(() -> {
                    if (popup.isShowing()) {
                        javafx.scene.Scene ps = popup.getScene();
                        if (ps == null || ps.getFocusOwner() == null) {
                            popup.hide();
                            setAccessibleText(label + " geschlossen");
                            requestFocus();
                        }
                    }
                });
            }
        });
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            setAccessibleText(label + " geschlossen");
        } else {
            Bounds bounds = localToScreen(getBoundsInLocal());
            if (bounds != null) {
                popup.show(this, bounds.getMinX(), bounds.getMaxY() + 2);
                setAccessibleText(label + " geöffnet – Escape zum Schließen");
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
        // Remove before conditionally re-adding to avoid duplicate style class entries
        getStyleClass().remove("filter-trigger-active");
        if (count > 0) {
            setText(label + " (" + count + ") \u25BE");
            getStyleClass().add("filter-trigger-active");
        } else {
            setText(label + " \u25BE");
        }
        // Keep accessible name in sync with visible text (WCAG 4.1.2)
        if (!popup.isShowing()) {
            setAccessibleText(getText());
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
