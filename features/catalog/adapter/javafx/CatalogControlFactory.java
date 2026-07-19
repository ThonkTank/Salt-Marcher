package features.catalog.adapter.javafx;

import javafx.scene.control.Button;
import javafx.scene.control.CheckMenuItem;
import javafx.scene.control.ComboBox;
import javafx.scene.control.MenuButton;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;

/** Sole owner of Catalog interactive-control visual roles. */
final class CatalogControlFactory {

    TextField text(String prompt, String accessible) {
        TextField field = new TextField();
        configure(field, prompt, accessible);
        return field;
    }

    <V> ComboBox<V> choice(String prompt, String accessible) {
        ComboBox<V> box = new ComboBox<>();
        box.setPromptText(prompt);
        box.setAccessibleText(accessible);
        size(box);
        return box;
    }

    Button action(String label, String accessible, boolean primary) {
        Button button = new Button(label);
        button.setAccessibleText(accessible);
        button.getStyleClass().add(primary ? "accent" : "neutral-action");
        size(button);
        return button;
    }

    MenuButton multiChoice(String prompt, String accessible) {
        MenuButton button = new MenuButton(prompt);
        button.setAccessibleText(accessible);
        button.getStyleClass().add("catalog-filter-control");
        size(button);
        return button;
    }

    Button chip(String text) {
        Button button = new Button(text + " ×");
        button.getStyleClass().addAll("compact", "catalog-filter-chip");
        return button;
    }

    ToggleButton section(String label, String accessible) {
        ToggleButton button = new ToggleButton(label);
        button.setAccessibleText(accessible);
        button.getStyleClass().add("catalog-section-button");
        size(button);
        return button;
    }

    CheckMenuItem multiChoiceItem(String label, boolean selected) {
        CheckMenuItem item = new CheckMenuItem(label);
        item.setSelected(selected);
        return item;
    }

    private static void configure(TextField field, String prompt, String accessible) {
        field.setPromptText(prompt);
        field.setAccessibleText(accessible);
        size(field);
    }

    private static void size(javafx.scene.control.Control control) {
        control.getStyleClass().add("catalog-filter-control");
    }
}
