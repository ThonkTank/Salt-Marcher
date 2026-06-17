package shell.host;

import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Rectangle;

final class ShellContentLayout {

    private ShellContentLayout() {
    }

    static Node shellOwned(Node content) {
        if (content instanceof Region region) {
            region.setMinSize(0.0, 0.0);
            region.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        }
        StackPane host = new StackPane(content);
        host.setMinSize(0.0, 0.0);
        host.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        clipToBounds(host);
        return host;
    }

    static Node stateScrollable(Node content) {
        Node scrollContent = content instanceof ScrollPane scrollPane
                ? scrollPane
                : stateScrollContentHost(content);
        if (scrollContent instanceof ScrollPane existingScrollPane) {
            configureStateScrollPane(existingScrollPane);
            return existingScrollPane;
        }
        ScrollPane scrollPane = new ScrollPane(scrollContent);
        configureStateScrollPane(scrollPane);
        return scrollPane;
    }

    static void makeShrinkable(Region region) {
        region.setMinSize(0.0, 0.0);
        region.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
    }

    static void clipToBounds(Region region) {
        Rectangle clip = new Rectangle();
        clip.widthProperty().bind(region.widthProperty());
        clip.heightProperty().bind(region.heightProperty());
        region.setClip(clip);
    }

    private static Node stateScrollContentHost(Node content) {
        if (content instanceof Region region) {
            region.setMinSize(0.0, 0.0);
            region.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        }
        StackPane host = new StackPane(content);
        host.setMinSize(0.0, 0.0);
        host.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        return host;
    }

    private static void configureStateScrollPane(ScrollPane scrollPane) {
        makeShrinkable(scrollPane);
        scrollPane.setFitToWidth(true);
        scrollPane.setFitToHeight(false);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        if (!scrollPane.getStyleClass().contains("shell-state-scroll")) {
            scrollPane.getStyleClass().add("shell-state-scroll");
        }
    }
}
