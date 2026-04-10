package ui.components.layout;

import javafx.geometry.Insets;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * Shared tiny layout helpers used by stacked control panes.
 */
@SuppressWarnings("unused")
public final class LayoutComponents {

    private LayoutComponents() {
        throw new AssertionError("No instances");
    }

    public static Region controlSeparator() {
        Region separator = new Region();
        separator.getStyleClass().add("control-separator");
        separator.setMinHeight(1);
        separator.setMaxHeight(1);
        VBox.setMargin(separator, new Insets(4, 0, 4, 0));
        return separator;
    }
}
