package features.world.dungeonmap.ui.shared.map;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.Objects;

public final class DungeonEditorToolbar extends VBox implements DungeonInlineControlsHost {

    private final DungeonMapControlsPane mapControls;

    public DungeonEditorToolbar(DungeonMapControlsPane mapControls) {
        this.mapControls = Objects.requireNonNull(mapControls, "mapControls");
        getStyleClass().addAll("map-editor-toolbar", "dungeon-editor-toolbar");
        setSpacing(8);
        setPadding(new Insets(8, 10, 8, 10));
        getChildren().add(mapControls);
    }

    public DungeonMapControlsPane mapControls() {
        return mapControls;
    }

    public FlowGroup createFlowGroup(String title) {
        Label groupLabel = sectionLabel(title);
        FlowPane flow = new FlowPane();
        flow.setHgap(6);
        flow.setVgap(6);
        flow.getStyleClass().add("editor-tool-flow");
        VBox group = new VBox(6, groupLabel, flow);
        group.getStyleClass().add("editor-toolbar-group");
        return new FlowGroup(group, flow);
    }

    public void setToolbarGroups(Node... groups) {
        setToolbarGroups(groups == null ? List.of() : List.of(groups));
    }

    public void setToolbarGroups(List<? extends Node> groups) {
        getChildren().setAll(mapControls);
        if (groups != null) {
            getChildren().addAll(groups);
        }
    }

    @Override
    public void setInlineTrailingNode(Node node) {
        mapControls.setInlineTrailingNode(node);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    public record FlowGroup(VBox container, FlowPane flow) {
    }
}
