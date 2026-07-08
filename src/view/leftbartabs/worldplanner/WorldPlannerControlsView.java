package src.view.leftbartabs.worldplanner;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;

public final class WorldPlannerControlsView extends HBox {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;
    private static final int SOURCES = 3;

    private final ToggleGroup modules = new ToggleGroup();
    private final ToggleButton npcs = moduleButton("NPCs", NPCS);
    private final ToggleButton factions = moduleButton("Fraktionen", FACTIONS);
    private final ToggleButton locations = moduleButton("Locations", LOCATIONS);
    private final ToggleButton sources = moduleButton("Encounter Sources", SOURCES);
    private final Button refresh = refreshButton();
    private Consumer<WorldPlannerControlsViewInputEvent> eventSink = event -> { };

    WorldPlannerControlsView() {
        super(8);
        getStyleClass().add("world-planner-controls");
        Label title = new Label("World Planner");
        title.getStyleClass().add("world-planner-title");
        HBox tabs = new HBox(6, npcs, factions, locations, sources, refresh);
        tabs.getStyleClass().add("world-planner-module-tabs");
        getChildren().addAll(title, tabs);
        setAlignment(Pos.CENTER_LEFT);
    }

    public void bind(WorldPlannerControlsContentModel model) {
        WorldPlannerControlsContentModel safeModel = Objects.requireNonNull(model, "model");
        safeModel.projectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.projectionProperty().get());
    }

    public void onViewInputEvent(Consumer<WorldPlannerControlsViewInputEvent> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private ToggleButton moduleButton(String label, int moduleIndex) {
        ToggleButton button = new ToggleButton(label);
        button.setToggleGroup(modules);
        button.getStyleClass().add("world-planner-module-tab");
        button.setOnAction(event -> emit(moduleIndex, false));
        return button;
    }

    private Button refreshButton() {
        Button button = new Button("Aktualisieren");
        button.getStyleClass().add("world-planner-refresh");
        button.setOnAction(event -> emit(selectedModuleIndex(), true));
        return button;
    }

    private void render(WorldPlannerControlsContentModel.Projection projection) {
        selectButton(projection.activeModuleIndex());
    }

    private void selectButton(int moduleIndex) {
        if (moduleIndex == FACTIONS) {
            factions.setSelected(true);
        } else if (moduleIndex == LOCATIONS) {
            locations.setSelected(true);
        } else if (moduleIndex == SOURCES) {
            sources.setSelected(true);
        } else {
            npcs.setSelected(true);
        }
    }

    private void emit(int moduleIndex, boolean refreshRequested) {
        eventSink.accept(new WorldPlannerControlsViewInputEvent(moduleIndex, refreshRequested));
    }

    private int selectedModuleIndex() {
        if (factions.isSelected()) {
            return FACTIONS;
        }
        if (locations.isSelected()) {
            return LOCATIONS;
        }
        if (sources.isSelected()) {
            return SOURCES;
        }
        return NPCS;
    }
}
