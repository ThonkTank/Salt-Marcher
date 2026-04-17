package shell.panel;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import shell.host.ContributionKey;
import shell.host.ShellTopBarSpec;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Passive shell top bar with title and sorted contribution content.
 */
public final class ShellToolbarStrip extends HBox {

    private final Label title = new Label();
    private final Region spacer = new Region();
    private final Map<ContributionKey, ToolbarItem> items = new LinkedHashMap<>();

    public ShellToolbarStrip() {
        super(8);
        getStyleClass().add("toolbar");
        setAlignment(Pos.CENTER_LEFT);
        title.getStyleClass().add("large");
        HBox.setHgrow(spacer, Priority.ALWAYS);
        getChildren().addAll(title, spacer);
    }

    public void registerItem(ShellTopBarSpec registrationSpec, Node content) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        items.put(registrationSpec.key(), new ToolbarItem(registrationSpec, content));
        rebuild();
    }

    public void showTitle(String titleText) {
        title.setText(titleText == null ? "" : titleText);
        rebuild();
    }

    private void rebuild() {
        getChildren().setAll(title, spacer);
        for (ToolbarItem item : getSortedItems()) {
            getChildren().add(item.content());
        }
    }

    private List<ToolbarItem> getSortedItems() {
        List<ToolbarItem> sorted = new ArrayList<>(items.values());
        sorted.sort(Comparator
                .comparingInt((ToolbarItem item) -> item.registrationSpec().itemOrder())
                .thenComparing(item -> item.registrationSpec().key().value()));
        return sorted;
    }

    private record ToolbarItem(
            ShellTopBarSpec registrationSpec,
            Node content
    ) {
    }
}
