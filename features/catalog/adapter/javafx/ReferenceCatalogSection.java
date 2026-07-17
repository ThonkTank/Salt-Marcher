package features.catalog.adapter.javafx;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;

final class ReferenceCatalogSection<T> implements CatalogSection {

    private final CatalogSectionId id;
    private final Node controls;
    private final BorderPane content = new BorderPane();
    private final ListView<T> values = new ListView<>();

    ReferenceCatalogSection(
            CatalogSectionId id,
            String emptyText,
            Function<T, String> label,
            Consumer<T> open,
            String detail,
            String createLabel,
            Runnable create
    ) {
        this.id = id;
        controls = createLabel == null || createLabel.isBlank()
                ? CatalogSectionControls.intro(id.label(), detail)
                : CatalogSectionControls.intro(id.label(), detail, createLabel, create);
        values.setAccessibleText(id.label() + "-Katalog");
        values.setPlaceholder(new Label(emptyText));
        values.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(T item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? "" : label.apply(item));
            }
        });
        values.setOnMouseClicked(event -> {
            T selected = values.getSelectionModel().getSelectedItem();
            if (selected != null && event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                open.accept(selected);
            }
        });
        values.setOnKeyPressed(event -> {
            T selected = values.getSelectionModel().getSelectedItem();
            if (selected != null && event.getCode() == KeyCode.ENTER) {
                open.accept(selected);
                event.consume();
            }
        });
        content.setCenter(values);
    }

    @Override
    public CatalogSectionId id() {
        return id;
    }

    @Override
    public Node controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    void apply(List<T> next) {
        T selected = values.getSelectionModel().getSelectedItem();
        values.getItems().setAll(next == null ? List.of() : next);
        if (selected != null && values.getItems().contains(selected)) {
            values.getSelectionModel().select(selected);
        }
    }
}
