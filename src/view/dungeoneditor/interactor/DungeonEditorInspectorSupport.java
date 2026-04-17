package src.view.dungeoneditor.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.dungeon.dungeonAPI;
import src.domain.mapcore.api.MapSelectionRef;
import src.domain.mapcore.api.MapSurfaceSnapshot;
import src.view.mapshared.Model.MapCellViewModel;

final class DungeonEditorInspectorSupport {

    private final dungeonAPI dungeon;
    private final InspectorSink inspector;

    DungeonEditorInspectorSupport(dungeonAPI dungeon, InspectorSink inspector) {
        this.dungeon = dungeon;
        this.inspector = inspector;
    }

    void showSelection(MapSurfaceSnapshot surface, MapCellViewModel cellViewModel) {
        MapSelectionRef selectionRef = resolveSelection(surface, cellViewModel);
        if (selectionRef == null) {
            inspector.clear();
            return;
        }
        inspector.push(new InspectorEntrySpec(
                selectionRef.label(),
                selectionRef.ownerKind() + ":" + selectionRef.ownerId(),
                () -> inspectorContent(selectionRef),
                null
        ));
    }

    private Node inspectorContent(MapSelectionRef selectionRef) {
        var details = dungeon.describeSelection(selectionRef.ownerKind(), selectionRef.ownerId());
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label title = new Label(details.title());
        title.getStyleClass().add("bold");
        Label summary = new Label(details.summary());
        summary.setWrapText(true);
        box.getChildren().addAll(title, summary);
        for (String fact : details.facts()) {
            Label line = new Label(fact);
            line.setWrapText(true);
            box.getChildren().add(line);
        }
        return box;
    }

    private @Nullable MapSelectionRef resolveSelection(MapSurfaceSnapshot surface, MapCellViewModel cellViewModel) {
        if (cellViewModel == null || cellViewModel.ownerKind() == null || cellViewModel.ownerKind().isBlank()) {
            return null;
        }
        return surface.selectableTargets().stream()
                .filter(target -> target.ownerId() == cellViewModel.ownerId())
                .filter(target -> target.ownerKind().equalsIgnoreCase(cellViewModel.ownerKind()))
                .findFirst()
                .orElse(null);
    }
}
