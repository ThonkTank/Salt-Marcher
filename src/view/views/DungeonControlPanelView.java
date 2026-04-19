package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public class DungeonControlPanelView extends VBox {

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonControlPanelView(String titleText) {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");
        getChildren().add(new Label(titleText));
    }

    protected final void addControl(Node control) {
        getChildren().add(control);
    }
}
