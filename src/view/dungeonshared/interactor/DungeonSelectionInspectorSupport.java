package src.view.dungeonshared.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.mapcore.api.MapSelectionRef;

import java.util.Objects;

/**
 * Shared shell-inspector publisher for dungeon map selections.
 */
public final class DungeonSelectionInspectorSupport {

    private final DungeonMapSurfaceController controller;
    private final InspectorSink inspector;

    public DungeonSelectionInspectorSupport(DungeonMapSurfaceController controller, InspectorSink inspector) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    public void showSelection(@Nullable MapSelectionRef selectionRef) {
        if (selectionRef == null) {
            inspector.clear();
            return;
        }
        inspector.push(new InspectorEntrySpec(
                selectionRef.label(),
                "dungeon:" + selectionRef.ownerKind() + ":" + selectionRef.ownerId() + ":" + selectionRef.partKind(),
                () -> content(selectionRef),
                null
        ));
    }

    private Node content(MapSelectionRef selectionRef) {
        var details = controller.describeSelection(selectionRef.ownerKind(), selectionRef.ownerId());
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
}
