package features.catalog.adapter.javafx;

import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

final class CatalogSectionControls {

    private CatalogSectionControls() {
    }

    static Node intro(String title, String detail) {
        return body(title, detail);
    }

    static Node intro(String title, String detail, String actionLabel, Runnable action) {
        VBox body = body(title, detail);
        Button button = new Button(actionLabel);
        button.getStyleClass().add("accent");
        button.setOnAction(ignored -> action.run());
        body.getChildren().add(button);
        return body;
    }

    private static VBox body(String title, String detail) {
        Label heading = new Label(title);
        heading.getStyleClass().add("catalog-section-heading");
        Label description = new Label(detail);
        description.setWrapText(true);
        description.getStyleClass().add("text-secondary");
        VBox body = new VBox(heading, description);
        body.getStyleClass().add("catalog-section-intro");
        return body;
    }
}
