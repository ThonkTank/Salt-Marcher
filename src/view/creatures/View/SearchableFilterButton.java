package src.view.creatures.View;

import javafx.geometry.Bounds;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
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

        SearchableFilterPopupSupport.PopupContent popupContent = SearchableFilterPopupSupport.buildPopupContent(
                label,
                SEARCH_FIELD_THRESHOLD,
                options,
                selectedValues,
                checkboxes,
                this::filterCheckboxes,
                this::fireSelectionChanged);

        popup = new Popup();
        popup.setAutoHide(true);
        popup.getContent().add(popupContent.content());
        SearchableFilterPopupSupport.installPopupHandlers(
                popup,
                label,
                popupContent.focusTarget(),
                popupContent.content(),
                this::refocusButton);
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

    private void fireSelectionChanged() {
        updateTriggerText();
        if (this.onChange != null) {
            this.onChange.run();
        }
    }

    private void refocusButton() {
        setAccessibleText(label + " geschlossen");
        requestFocus();
    }
}
