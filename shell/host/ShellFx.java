package shell.host;

import javafx.scene.Node;
import javafx.scene.control.SplitPane;
import javafx.scene.layout.Pane;
import javafx.collections.ObservableList;

final class ShellFx {

    private ShellFx() {
    }

    static void addStyleClass(Node node, String styleClass) {
        ObservableList<String> styleClasses = node.getStyleClass();
        styleClasses.add(styleClass);
    }

    static void addStyleClasses(Node node, String... styleClasses) {
        ObservableList<String> nodeStyleClasses = node.getStyleClass();
        nodeStyleClasses.addAll(styleClasses);
    }

    static void addChild(Pane pane, Node child) {
        ObservableList<Node> children = pane.getChildren();
        children.add(child);
    }

    static void addChildren(Pane pane, Node... children) {
        ObservableList<Node> paneChildren = pane.getChildren();
        paneChildren.addAll(children);
    }

    static void clearChildren(Pane pane) {
        ObservableList<Node> children = pane.getChildren();
        children.clear();
    }

    static void setChildren(Pane pane, Node... children) {
        ObservableList<Node> paneChildren = pane.getChildren();
        paneChildren.setAll(children);
    }

    static void setSplitPaneItems(SplitPane splitPane, Node... items) {
        ObservableList<Node> splitPaneItems = splitPane.getItems();
        splitPaneItems.setAll(items);
    }
}
