package src.view.dungeonshared.assembly;

import java.util.Objects;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.mapcore.api.MapSelectionRef;
import src.view.dungeonshared.interactor.DungeonSelectionPublisher;

public final class DungeonSelectionInspectorShellAdapter implements DungeonSelectionPublisher {

    private final InspectorSink inspector;

    public DungeonSelectionInspectorShellAdapter(InspectorSink inspector) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    @Override
    public void clear() {
        inspector.clear();
    }

    @Override
    public void showSelection(MapSelectionRef selectionRef, DungeonInspectorSnapshot snapshot) {
        inspector.push(new InspectorEntrySpec(
                selectionRef.label(),
                "dungeon:" + selectionRef.ownerKind() + ":" + selectionRef.ownerId() + ":" + selectionRef.partKind(),
                () -> content(snapshot),
                null
        ));
    }

    private Node content(DungeonInspectorSnapshot snapshot) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label title = new Label(snapshot.title());
        title.getStyleClass().add("bold");
        Label summary = new Label(snapshot.summary());
        summary.setWrapText(true);
        box.getChildren().addAll(title, summary);
        for (String fact : snapshot.facts()) {
            Label line = new Label(fact);
            line.setWrapText(true);
            box.getChildren().add(line);
        }
        return box;
    }
}
