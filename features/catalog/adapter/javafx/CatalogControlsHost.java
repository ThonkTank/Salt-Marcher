package features.catalog.adapter.javafx;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/** Fixed typed section rail plus the active section's persistent controls. */
final class CatalogControlsHost extends VBox {

    private final Map<CatalogSectionId, ToggleButton> buttons = new EnumMap<>(CatalogSectionId.class);
    private final VBox activeControls = new VBox();
    private Consumer<CatalogSectionId> selectionHandler = ignored -> { };

    CatalogControlsHost(List<CatalogSection> sections) {
        getStyleClass().add("catalog-controls-host");
        ToggleGroup group = new ToggleGroup();
        FlowPane rail = new FlowPane();
        rail.getStyleClass().add("catalog-section-rail");
        for (CatalogSection section : sections) {
            ToggleButton button = new ToggleButton(section.id().label());
            button.getStyleClass().add("catalog-section-button");
            button.setAccessibleText("Katalogbereich " + section.id().label());
            button.setUserData(section.id());
            button.setToggleGroup(group);
            button.setOnAction(ignored -> {
                if (!button.isSelected()) {
                    button.setSelected(true);
                }
                selectionHandler.accept(section.id());
            });
            buttons.put(section.id(), button);
            rail.getChildren().add(button);
        }
        group.selectedToggleProperty().addListener((ignored, before, after) -> {
            if (after == null) {
                return;
            }
            selectionHandler.accept((CatalogSectionId) after.getUserData());
        });
        activeControls.getStyleClass().add("catalog-active-controls");
        activeControls.setMinHeight(0.0);
        activeControls.setMaxHeight(Double.MAX_VALUE);
        ScrollPane scroll = new ScrollPane(activeControls);
        scroll.getStyleClass().add("catalog-section-controls-scroll");
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        getChildren().setAll(rail, scroll);
        VBox.setVgrow(scroll, Priority.ALWAYS);
    }

    void onSectionSelected(Consumer<CatalogSectionId> handler) {
        selectionHandler = handler == null ? ignored -> { } : handler;
    }

    void show(CatalogSection section) {
        Node controls = section.controls();
        if (controls instanceof Region region) {
            region.setMinHeight(0.0);
            region.setMaxHeight(Double.MAX_VALUE);
        }
        activeControls.getChildren().setAll(controls);
        VBox.setVgrow(controls, Priority.ALWAYS);
        ToggleButton button = buttons.get(section.id());
        if (button != null && !button.isSelected()) {
            button.setSelected(true);
        }
    }

    void select(CatalogSectionId id) {
        ToggleButton button = buttons.get(id);
        if (button == null) {
            return;
        }
        button.setSelected(true);
        selectionHandler.accept(id);
    }

    List<String> sectionTitles() {
        return buttons.keySet().stream().map(CatalogSectionId::label).toList();
    }
}
