package shell.host;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ContentDisplay;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Passive left navigation that renders tabs discovered by the shell.
 */
public final class ShellNavigationSidebar extends VBox {

    private final Map<ContributionKey, NavigationItem> items = new LinkedHashMap<>();
    private final ToggleGroup navGroup = new ToggleGroup();

    public ShellNavigationSidebar() {
        getStyleClass().add("nav-sidebar");
        setAlignment(Pos.TOP_CENTER);
    }

    public void registerTab(ShellTabSpec registrationSpec, ShellScreen screen, Consumer<ContributionKey> onSelect) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(screen, "screen");
        Objects.requireNonNull(onSelect, "onSelect");
        ToggleButton button = createButton(screen, registrationSpec.key(), onSelect);
        items.put(registrationSpec.key(), new NavigationItem(registrationSpec, screen.getTitle(), button));
        rebuild();
    }

    public void select(ContributionKey key) {
        NavigationItem item = items.get(key);
        if (item != null) {
            item.button().setSelected(true);
        }
    }

    private ToggleButton createButton(ShellScreen screen, ContributionKey key, Consumer<ContributionKey> onSelect) {
        ToggleButton button = new ToggleButton(screen.getNavigationLabel());
        button.getStyleClass().add("nav-btn");
        button.setToggleGroup(navGroup);
        button.setTooltip(new Tooltip(screen.getTitle()));
        button.setAccessibleText(screen.getTitle());
        Node graphic = screen.getNavigationGraphic();
        if (graphic != null) {
            button.setGraphic(graphic);
            button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
            button.setGraphicTextGap(0);
        }
        button.setOnAction(event -> onSelect.accept(key));
        return button;
    }

    private void rebuild() {
        getChildren().clear();
        String previousGroupKey = null;
        for (NavigationItem item : getSortedItems()) {
            NavigationGroupSpec group = item.registrationSpec().navigationGroup();
            String currentGroupKey = group.key();
            if (previousGroupKey != null && !previousGroupKey.equals(currentGroupKey)) {
                Region separator = new Region();
                separator.getStyleClass().add("nav-separator");
                separator.setMinHeight(1);
                separator.setPrefHeight(1);
                getChildren().add(separator);
            }
            getChildren().add(item.button());
            previousGroupKey = currentGroupKey;
        }
    }

    private List<NavigationItem> getSortedItems() {
        List<NavigationItem> sorted = new ArrayList<>(items.values());
        sorted.sort(Comparator
                .comparingInt((NavigationItem item) -> item.registrationSpec().navigationGroup().order())
                .thenComparing(item -> item.registrationSpec().navigationGroup().label(), String.CASE_INSENSITIVE_ORDER)
                .thenComparingInt(item -> item.registrationSpec().viewOrder())
                .thenComparing(NavigationItem::screenTitle, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(item -> item.registrationSpec().key().value()));
        return sorted;
    }

    private record NavigationItem(
            ShellTabSpec registrationSpec,
            String screenTitle,
            ToggleButton button
    ) {
    }
}
