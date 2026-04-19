package shell.host;

import javafx.scene.Node;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.Pane;

@SuppressWarnings("PMD.LawOfDemeter")
final class ShellFx {

    private ShellFx() {
    }

    static void addStyleClass(Node node, String styleClass) {
        node.getStyleClass().add(styleClass);
    }

    static void addStyleClasses(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    static void addChild(Pane pane, Node child) {
        pane.getChildren().add(child);
    }

    static void addChildren(Pane pane, Node... children) {
        pane.getChildren().addAll(children);
    }

    static void clearChildren(Pane pane) {
        pane.getChildren().clear();
    }

    static void setChildren(Pane pane, Node... children) {
        pane.getChildren().setAll(children);
    }

    static void setSplitPaneItems(SplitPane splitPane, Node... items) {
        splitPane.getItems().setAll(items);
    }
}
