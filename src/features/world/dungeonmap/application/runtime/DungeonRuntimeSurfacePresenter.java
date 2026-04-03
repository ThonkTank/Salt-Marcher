package features.world.dungeonmap.application.runtime;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonRuntimeSurfacePresenter {

    private DungeonRuntimeSurfacePresenter() {
        throw new AssertionError("No instances");
    }

    public static Node buildNode(
            DungeonRuntimeSurface surface,
            Consumer<DungeonRuntimeAction> onActionSelected
    ) {
        VBox box = new VBox(8);
        box.setPadding(new Insets(12));
        if (surface == null) {
            box.getChildren().add(text("Keine Beschreibung verfügbar"));
            return box;
        }
        box.getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                text(valueOrDash(surface.visualDescription())));
        box.getChildren().add(sectionTitle("Durchgänge"));
        if (surface.doors().isEmpty()) {
            box.getChildren().add(text("—"));
        } else {
            for (DungeonRuntimeSurface.DoorInfo door : surface.doors()) {
                box.getChildren().add(doorLine(door));
            }
        }
        appendActionButtons(box, surface.actions(), onActionSelected);
        return box;
    }

    private static void appendActionButtons(
            VBox box,
            List<DungeonRuntimeAction> actions,
            Consumer<DungeonRuntimeAction> onActionSelected
    ) {
        box.getChildren().add(sectionTitle("Aktionen"));
        if (actions == null || actions.isEmpty()) {
            box.getChildren().add(text("—"));
            return;
        }
        for (DungeonRuntimeAction action : actions) {
            Button button = new Button(action.label());
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> {
                if (onActionSelected != null) {
                    onActionSelected.accept(action);
                }
            });
            box.getChildren().add(button);
            if (action.description() != null && !action.description().isBlank()) {
                box.getChildren().add(text(action.description()));
            }
        }
    }

    private static Label sectionTitle(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static Label text(String text) {
        Label label = new Label(text);
        label.setWrapText(true);
        return label;
    }

    private static TextFlow doorLine(DungeonRuntimeSurface.DoorInfo door) {
        Text prefix = new Text(doorDescriptionPrefix(door) + " ");
        prefix.setStyle("-fx-fill: -sm-text-muted;");

        Text description = new Text(valueOrDash(door.description()));
        description.setStyle("-fx-fill: -sm-text-primary;");
        TextFlow flow = new TextFlow(prefix, description);
        flow.setLineSpacing(2);
        return flow;
    }

    private static String doorDescriptionPrefix(DungeonRuntimeSurface.DoorInfo door) {
        String destination = door.destinationLabel();
        if (destination == null || destination.isBlank()) {
            return "[" + door.number() + "]";
        }
        return "[" + door.number() + ": " + destination + "]";
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
