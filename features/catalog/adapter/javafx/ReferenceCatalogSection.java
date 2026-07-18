package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.scene.Node;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

/** Persistent tabular reference section with explicit, non-mutating row actions. */
public final class ReferenceCatalogSection<T> implements CatalogSection {

    private final CatalogSectionId id;
    private final VBox controls;
    private final CatalogSectionFrame<T> content;

    public ReferenceCatalogSection(
            CatalogSectionId id,
            String emptyText,
            Function<T, String> label,
            Function<T, String> detail,
            Consumer<T> open,
            String description,
            String createLabel,
            Runnable create
    ) {
        this.id = id;
        content = new CatalogSectionFrame<>(id.label(), emptyText,
                value -> label.apply(value) + " " + detail.apply(value), open, "", () -> { });
        content.addTextColumn("Name", 240.0, label);
        content.addTextColumn("Details", 420.0, detail);
        TextField query = new TextField();
        query.setAccessibleText(id.label() + " suchen");
        query.setPromptText(id.label() + " suchen …");
        query.textProperty().addListener((ignored, before, after) -> content.setQuery(after));
        Node intro = createLabel == null || createLabel.isBlank()
                ? CatalogSectionControls.intro(id.label(), description)
                : CatalogSectionControls.intro(id.label(), description, createLabel, create);
        controls = new VBox(intro, query);
        controls.getStyleClass().add("catalog-section-intro");
    }

    public ReferenceCatalogSection(
            CatalogSectionId id,
            String emptyText,
            Function<T, String> label,
            Function<T, String> detail,
            String description
    ) {
        this.id = id;
        content = new CatalogSectionFrame<>(id.label(), emptyText,
                value -> label.apply(value) + " " + detail.apply(value));
        content.addTextColumn("Name", 240.0, label);
        content.addTextColumn("Details", 420.0, detail);
        TextField query = new TextField();
        query.setAccessibleText(id.label() + " suchen");
        query.setPromptText(id.label() + " suchen …");
        query.textProperty().addListener((ignored, before, after) -> content.setQuery(after));
        controls = new VBox(CatalogSectionControls.intro(id.label(), description), query);
        controls.getStyleClass().add("catalog-section-intro");
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

    public void addAction(String title, String buttonText, Consumer<T> action) {
        content.addActionColumn(title, buttonText, action);
    }

    public void apply(List<T> next) {
        T selected = content.table().getSelectionModel().getSelectedItem();
        content.apply(next);
        if (selected != null && content.table().getItems().contains(selected)) {
            content.table().getSelectionModel().select(selected);
        }
    }
}
