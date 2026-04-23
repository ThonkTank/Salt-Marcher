package src.view.slotcontent.primitives.dialog;

import java.util.Arrays;
import java.util.List;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
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
        header.getStyleClass().add("dialog-header");
        bodyHost.getStyleClass().add("dialog-body");
        footerHost.getStyleClass().add("dialog-footer");
        bodyScroll.getStyleClass().add("dialog-body-scroll");
        bodyScroll.setFitToWidth(true);
        bodyScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        bodyScroll.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        VBox.setVgrow(bodyHost, Priority.ALWAYS);
        getChildren().addAll(header, bodyHost, footerHost);
    }

    public void setHeader(Node... nodes) {
        replace(header, nodes);
        setVisibleAndManaged(header, !header.getChildren().isEmpty());
    }

    public void setBody(Node node, BodyPolicy policy) {
        bodyHost.getChildren().clear();
        if (node == null) {
            return;
        }
        if (policy == BodyPolicy.SCROLL) {
            bodyScroll.setContent(node);
            bodyHost.getChildren().setAll(bodyScroll);
        } else {
            bodyScroll.setContent(null);
            bodyHost.getChildren().setAll(node);
        }
    }

    public void setFooter(Node... nodes) {
        if (nodes == null || nodes.length == 0) {
            footerHost.getChildren().clear();
            setVisibleAndManaged(footerHost, false);
            return;
        }
        HBox footer = new HBox(8, nodes);
        footer.getStyleClass().add("dialog-action-row");
        footerHost.getChildren().setAll(footer);
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
        container.getChildren().setAll(safeNodes);
    }

    private static void setVisibleAndManaged(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }
}
