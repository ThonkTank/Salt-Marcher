package features.catalog.adapter.javafx;

import java.util.Objects;
import java.util.function.Function;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ListCell;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.util.StringConverter;

/** Owns the visual and labeling contract for interactive Catalog controls. */
final class CatalogControlKit {

    private static final String CONTROL = "catalog-control";

    private CatalogControlKit() { }

    static TextField search(String accessibleText, String promptText) {
        TextField field = new TextField();
        field.setAccessibleText(Objects.requireNonNull(accessibleText, "accessibleText"));
        field.setPromptText(Objects.requireNonNull(promptText, "promptText"));
        style(field, "catalog-search-control");
        return field;
    }

    static TextField filterText(String accessibleText, String promptText) {
        TextField field = new TextField();
        field.setAccessibleText(Objects.requireNonNull(accessibleText, "accessibleText"));
        field.setPromptText(Objects.requireNonNull(promptText, "promptText"));
        style(field, "catalog-filter-control");
        return field;
    }

    static <T> ComboBox<T> select(
            String insideLabel,
            String accessibleText,
            Function<T, String> optionLabel
    ) {
        String requiredLabel = Objects.requireNonNull(insideLabel, "insideLabel");
        Function<T, String> requiredOptionLabel = Objects.requireNonNull(optionLabel, "optionLabel");
        ComboBox<T> box = new ComboBox<>();
        box.setAccessibleText(Objects.requireNonNull(accessibleText, "accessibleText"));
        box.setConverter(new StringConverter<>() {
            @Override public String toString(T value) {
                return value == null ? "" : safeLabel(requiredOptionLabel.apply(value));
            }

            @Override public T fromString(String value) {
                throw new UnsupportedOperationException("Catalog selections are chosen, not parsed.");
            }
        });
        box.setCellFactory(ignored -> optionCell(requiredOptionLabel));
        box.setButtonCell(new ListCell<>() {
            {
                getStyleClass().add("catalog-select-button-cell");
            }

            @Override
            protected void updateItem(T item, boolean empty) {
                super.updateItem(item, empty);
                String value = item == null ? "" : safeLabel(requiredOptionLabel.apply(item));
                setText(value.isBlank() ? requiredLabel : requiredLabel + ": " + value);
                setGraphic(null);
            }
        });
        style(box, "catalog-filter-control", "catalog-select-control");
        return box;
    }

    static Button action(String text, String accessibleText, boolean accent) {
        Button button = button(text, accessibleText, "catalog-action-control");
        if (accent) {
            button.getStyleClass().add("accent");
        }
        return button;
    }

    static Button filterButton(String text, String accessibleText) {
        return button(text, accessibleText, "catalog-filter-control");
    }

    static Button clear(String accessibleText) {
        Button button = action("Filter leeren", accessibleText, false);
        button.getStyleClass().add("flat");
        return button;
    }

    static ToggleButton section(String text, String accessibleText) {
        ToggleButton button = new ToggleButton(Objects.requireNonNull(text, "text"));
        button.setAccessibleText(Objects.requireNonNull(accessibleText, "accessibleText"));
        style(button, "catalog-section-button");
        return button;
    }

    private static Button button(String text, String accessibleText, String role) {
        Button button = new Button(Objects.requireNonNull(text, "text"));
        button.setAccessibleText(Objects.requireNonNull(accessibleText, "accessibleText"));
        style(button, role);
        return button;
    }

    private static <T> ListCell<T> optionCell(Function<T, String> optionLabel) {
        return new ListCell<>() {
            {
                getStyleClass().add("catalog-select-option");
            }

            @Override
            protected void updateItem(T item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? "" : safeLabel(optionLabel.apply(item)));
                setGraphic(null);
            }
        };
    }

    private static void style(javafx.scene.control.Control control, String... roles) {
        if (!control.getStyleClass().contains(CONTROL)) {
            control.getStyleClass().add(CONTROL);
        }
        for (String role : roles) {
            if (!control.getStyleClass().contains(role)) {
                control.getStyleClass().add(role);
            }
        }
    }

    private static String safeLabel(String value) {
        return value == null ? "" : value;
    }
}
