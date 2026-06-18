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
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

/**
 * Passive left navigation that renders left-bar tabs discovered by the shell.
 */
final class ShellNavigationSidebar extends VBox {

    private final Map<ContributionKey, NavigationItem> items = new LinkedHashMap<>();
    private final ToggleGroup navGroup = new ToggleGroup();

    ShellNavigationSidebar() {
        getStyleClass().add("nav-sidebar");
        setAlignment(Pos.TOP_CENTER);
    }

    void registerLeftBarTab(ShellLeftBarTabSpec registrationSpec, ShellBinding binding, Consumer<ContributionKey> onSelect) {
        Objects.requireNonNull(registrationSpec, "registrationSpec");
        Objects.requireNonNull(binding, "binding");
        Objects.requireNonNull(onSelect, "onSelect");
        ToggleButton button = createButton(registrationSpec, binding, onSelect);
        items.put(registrationSpec.key(), new NavigationItem(registrationSpec, binding.title(), button));
        rebuild();
    }

    void select(ContributionKey key) {
        NavigationItem item = items.get(key);
        if (item != null) {
            item.button().setSelected(true);
        }
    }

    private ToggleButton createButton(
            ShellLeftBarTabSpec registrationSpec,
            ShellBinding binding,
            Consumer<ContributionKey> onSelect) {
        ToggleButton button = new ToggleButton();
        ShellFx.addStyleClass(button, "nav-btn");
        button.setToggleGroup(navGroup);
        button.setTooltip(new Tooltip(binding.title()));
        button.setAccessibleText(binding.title());
        Node graphic = ShellNavigationGraphicLoader.load(registrationSpec.navigationGraphic());
        button.setGraphic(graphic);
        button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
        button.setGraphicTextGap(0);
        button.setOnAction(event -> onSelect.accept(registrationSpec.key()));
        return button;
    }

    private void rebuild() {
        getChildren().clear();
        ShellLeftBarTabMode previousMode = null;
        for (NavigationItem item : getSortedItems()) {
            ShellLeftBarTabMode currentMode = item.registrationSpec().mode();
            if (previousMode != null && previousMode != currentMode) {
                Region separator = new Region();
                ShellFx.addStyleClass(separator, "nav-separator");
                getChildren().add(separator);
            }
            getChildren().add(item.button());
            previousMode = currentMode;
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
            ShellLeftBarTabSpec registrationSpec,
            String screenTitle,
            ToggleButton button
    ) {
    }
}
