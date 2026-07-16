package src.view.leftbartabs.catalog;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

final class CatalogWorkspaceView {

    private final Map<CatalogSection, Content> contents;
    private final Map<CatalogSection, ToggleButton> buttons = new EnumMap<>(CatalogSection.class);
    private final Consumer<CatalogSection> activation;
    private final VBox controls = new VBox(10);
    private final StackPane main = new StackPane();
    private final FlowPane tabs = new FlowPane(6, 6);

    CatalogWorkspaceView(Map<CatalogSection, Content> contents, Consumer<CatalogSection> activation) {
        this.contents = Map.copyOf(contents);
        this.activation = activation == null ? ignored -> { } : activation;
        configureTabs();
        controls.getStyleClass().add("catalog-workspace-controls");
        main.getStyleClass().add("catalog-workspace-main");
        VBox.setVgrow(main, Priority.ALWAYS);
        show(CatalogSection.MONSTERS);
    }

    Node controls() {
        return controls;
    }

    Node main() {
        return main;
    }

    void show(CatalogSection section) {
        CatalogSection safeSection = contents.containsKey(section) ? section : CatalogSection.MONSTERS;
        Content content = Objects.requireNonNull(contents.get(safeSection), "catalog content");
        controls.getChildren().setAll(tabs, content.controls());
        main.getChildren().setAll(content.main());
        buttons.get(safeSection).setSelected(true);
        activation.accept(safeSection);
    }

    private void configureTabs() {
        ToggleGroup group = new ToggleGroup();
        tabs.setAlignment(Pos.CENTER_LEFT);
        tabs.getStyleClass().add("catalog-content-tabs");
        for (CatalogSection section : CatalogSection.values()) {
            ToggleButton button = new ToggleButton(section.label());
            button.setToggleGroup(group);
            button.getStyleClass().add("catalog-content-tab");
            button.setOnAction(event -> show(section));
            buttons.put(section, button);
            tabs.getChildren().add(button);
        }
    }

    record Content(Node controls, Node main) {
        Content {
            Objects.requireNonNull(controls, "controls");
            Objects.requireNonNull(main, "main");
        }
    }
}
