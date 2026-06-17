package shell.api;

import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class ShellControls {

    private ShellControls() {
    }

    public static Node stack(Node fixed, Node flexible) {
        VBox stack = new VBox(8.0);
        addFixed(stack, fixed);
        addFlexible(stack, flexible);
        return stack;
    }

    private static void addFixed(VBox stack, Node node) {
        if (node != null) {
            stack.getChildren().add(node);
        }
    }

    private static void addFlexible(VBox stack, Node node) {
        if (node == null) {
            return;
        }
        if (node instanceof Region region) {
            region.setMinHeight(0.0);
            region.setMaxHeight(Double.MAX_VALUE);
        }
        stack.getChildren().add(node);
        VBox.setVgrow(node, Priority.ALWAYS);
    }
}
