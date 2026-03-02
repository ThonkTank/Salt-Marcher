package ui.components;

import javafx.scene.control.CheckBox;
import javafx.scene.control.TextField;
import javafx.scene.control.TitledPane;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class CheckboxFilterSection extends TitledPane {

    private final List<CheckBox> checkboxes = new ArrayList<>();
    private final TextField searchField;
    private final Consumer<List<String>> onChange;

    public CheckboxFilterSection(String title, List<String> options, Consumer<List<String>> onChange) {
        this.onChange = onChange;
        setText(title);
        setCollapsible(true);
        setExpanded(true);
        setAnimated(false);

        VBox content = new VBox(2);

        searchField = new TextField();
        searchField.setPromptText(title + " durchsuchen...");
        searchField.textProperty().addListener((obs, o, n) -> filterCheckboxes());

        if (options.size() > 8) {
            content.getChildren().add(searchField);
        }

        for (String option : options) {
            CheckBox cb = new CheckBox(option);
            cb.setOnAction(e -> fireChange());
            checkboxes.add(cb);
            content.getChildren().add(cb);
        }

        setContent(content);
    }

    private void filterCheckboxes() {
        String query = searchField.getText().trim().toLowerCase();
        for (CheckBox cb : checkboxes) {
            boolean match = query.isEmpty() || cb.getText().toLowerCase().contains(query);
            cb.setVisible(match);
            cb.setManaged(match);
        }
    }

    private void fireChange() {
        if (onChange != null) onChange.accept(getSelectedValues());
    }

    public List<String> getSelectedValues() {
        List<String> selected = new ArrayList<>();
        for (CheckBox cb : checkboxes) {
            if (cb.isSelected()) selected.add(cb.getText());
        }
        return selected;
    }

    public void clearSelection() {
        searchField.setText("");
        for (CheckBox cb : checkboxes) {
            cb.setSelected(false);
        }
    }
}
