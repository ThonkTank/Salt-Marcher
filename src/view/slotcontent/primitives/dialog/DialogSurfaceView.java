package src.view.slotcontent.primitives.dialog;

import java.util.function.Consumer;
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
    private final VBox header = new VBox(2);
    private final StackPane bodyHost = new StackPane();
    private final StackPane footerHost = new StackPane();
    private final ScrollPane bodyScroll = new ScrollPane();
    private final StackPane headerContentHost = new StackPane();
    private final StackPane bodyContentHost = new StackPane();
    private final StackPane footerContentHost = new StackPane();

    private DialogSurfaceContentModel contentModel = new DialogSurfaceContentModel();
    private javafx.beans.value.ChangeListener<DialogSurfaceContentModel.LayoutState> layoutStateListener;

    public DialogSurfaceView(Node headerContent, Node bodyContent, Node footerContent) {
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
        replace(headerContentHost, headerContent);
        replace(bodyContentHost, bodyContent);
        replace(footerContentHost, footerContent);
        bind(contentModel);
    }

    public void bind(DialogSurfaceContentModel contentModel) {
        if (layoutStateListener != null) {
            this.contentModel.layoutStateProperty().removeListener(layoutStateListener);
        }
        this.contentModel = contentModel == null ? new DialogSurfaceContentModel() : contentModel;
        layoutStateListener = (ignored, before, after) -> applyLayout(after);
        this.contentModel.layoutStateProperty().addListener(layoutStateListener);
        applyLayout(this.contentModel.currentLayoutState());
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

    private void applyLayout(DialogSurfaceContentModel.LayoutState layoutState) {
        DialogSurfaceContentModel.LayoutState safeState = layoutState == null
                ? DialogSurfaceContentModel.LayoutState.initial()
                : layoutState;
        replace(header, headerContentHost);
        setVisibleAndManaged(header, safeState.showHeader(FxAccess.hasChildren(headerContentHost)));
        renderBody(safeState.bodyPolicy(), FxAccess.hasChildren(bodyContentHost));
        replace(footerHost, footerContentHost);
        setVisibleAndManaged(footerHost, safeState.showFooter(FxAccess.hasChildren(footerContentHost)));
    }

    private void renderBody(DialogSurfaceContentModel.BodyPolicy bodyPolicy, boolean bodyHasContent) {
        FxAccess.clearChildren(bodyHost);
        if (!bodyHasContent) {
            bodyScroll.setContent(null);
            return;
        }
        if (bodyPolicy.usesScrollHost()) {
            bodyScroll.setContent(bodyContentHost);
            FxAccess.setChildren(bodyHost, bodyScroll);
            return;
        }
        bodyScroll.setContent(null);
        FxAccess.setChildren(bodyHost, bodyContentHost);
    }

    private static void replace(Pane container, Node child) {
        if (child == null) {
            container.getChildren().clear();
            return;
        }
        container.getChildren().setAll(child);
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

        private static void setChildren(Pane parent, Node... children) {
            parent.getChildren().setAll(children);
        }

        private static boolean hasChildren(Pane parent) {
            return !parent.getChildren().isEmpty();
        }
    }
}
