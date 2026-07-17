package features.catalog.adapter.javafx;

import java.util.List;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

/** Keeps the established monster controls and supplies equivalent category controls. */
final class CatalogControlsHost extends CatalogControlsView {

    private final List<Node> monsterControls;

    CatalogControlsHost() {
        monsterControls = List.copyOf(getChildren());
    }

    void showMonster() {
        getChildren().setAll(monsterControls);
    }

    void showSection(
            String title,
            String prompt,
            Consumer<String> search,
            String createLabel,
            Runnable create
    ) {
        Label heading = new Label(title.toUpperCase(java.util.Locale.ROOT));
        heading.getStyleClass().add("section-header");
        TextField query = new TextField();
        query.setPromptText(prompt);
        query.setAccessibleText(title + " suchen");
        query.textProperty().addListener((ignored, before, after) -> search.accept(after));
        VBox surface = new VBox(8, query);
        surface.getStyleClass().add("filter-surface");
        if (createLabel != null && !createLabel.isBlank()) {
            Button createButton = new Button(createLabel);
            createButton.getStyleClass().addAll("accent", "compact");
            createButton.setOnAction(ignored -> create.run());
            surface.getChildren().add(createButton);
        }
        getChildren().setAll(heading, surface);
    }
}
