package src.view.slotcontent.primitives.dialog;

import java.util.Arrays;
import java.util.List;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class DialogSurfaceView extends VBox {

    public enum BodyPolicy {
        FIXED,
        SCROLL
    }

    private final VBox header = new VBox(2);
    private final StackPane bodyHost = new StackPane();
    private final StackPane footerHost = new StackPane();
    private final ScrollPane bodyScroll = new ScrollPane();

    public DialogSurfaceView() {
        getStyleClass().add("dialog-surface");
        setFillWidth(true);
        FxAccess.addStyle(header, "dialog-header");
        FxAccess.addStyle(bodyHost, "dialog-body");
        FxAccess.addStyle(footerHost, "dialog-footer");
        FxAccess.addStyle(bodyScroll, "dialog-body-scroll");
        bodyScroll.setFitToWidth(true);
        bodyScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        bodyScroll.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        setVgrow(bodyHost, Priority.ALWAYS);
        FxAccess.addChildren(this, header, bodyHost, footerHost);
    }

    public void setHeader(Node... nodes) {
        replace(header, nodes);
        setVisibleAndManaged(header, FxAccess.hasChildren(header));
    }

    public void setBody(Node node, BodyPolicy policy) {
        FxAccess.clearChildren(bodyHost);
        if (node == null) {
            return;
        }
        if (policy == BodyPolicy.SCROLL) {
            bodyScroll.setContent(node);
            FxAccess.setChildren(bodyHost, bodyScroll);
        } else {
            bodyScroll.setContent(null);
            FxAccess.setChildren(bodyHost, node);
        }
    }

    public void setFooter(Node... nodes) {
        if (nodes == null || nodes.length == 0) {
            FxAccess.clearChildren(footerHost);
            setVisibleAndManaged(footerHost, false);
            return;
        }
        HBox footer = new HBox(8, nodes);
        FxAccess.addStyle(footer, "dialog-action-row");
        FxAccess.setChildren(footerHost, footer);
        setVisibleAndManaged(footerHost, true);
    }

    public static Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    public static void grow(Node node) {
        HBox.setHgrow(node, Priority.ALWAYS);
    }

    public static Insets contentInsets() {
        return new Insets(8, 12, 8, 12);
    }

    private static void replace(VBox container, Node... nodes) {
        List<Node> safeNodes = nodes == null ? List.of() : Arrays.stream(nodes)
                .filter(node -> node != null)
                .toList();
        FxAccess.setChildren(container, safeNodes);
    }

    private static void setVisibleAndManaged(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

        private static void addStyle(Node node, String styleClass) {
            node.getStyleClass().add(styleClass);
        }

        private static void addChildren(Pane parent, Node... children) {
            parent.getChildren().addAll(children);
        }

        private static void clearChildren(Pane parent) {
            parent.getChildren().clear();
        }

        private static boolean hasChildren(Pane parent) {
            return !parent.getChildren().isEmpty();
        }

        private static void setChildren(Pane parent, Node... children) {
            parent.getChildren().setAll(children);
        }

        private static void setChildren(Pane parent, List<Node> children) {
            parent.getChildren().setAll(children);
        }
    }
}
