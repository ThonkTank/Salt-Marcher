package shell.host;

import javafx.scene.Node;
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
}
