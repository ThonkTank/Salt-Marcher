package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.application.runtime.DungeonRuntimeExit;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonRuntimeSurfacePane extends VBox {

    public DungeonRuntimeSurfacePane(
            DungeonRuntimeSurface surface,
            Consumer<DungeonRuntimeAction> onActionSelected
    ) {
        super(8);
        setPadding(new Insets(12));
        if (surface == null) {
            getChildren().add(text("Keine Beschreibung verfügbar"));
            return;
        }
        getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                text(valueOrDash(surface.visualDescription())));
        getChildren().add(sectionTitle("Durchgänge"));
        if (surface.exits().isEmpty()) {
            getChildren().add(text("—"));
        } else {
            for (DungeonRuntimeExit exit : surface.exits()) {
                getChildren().add(exitLine(exit));
            }
        }
        appendActionButtons(surface.availableActions(), onActionSelected);
    }

    private void appendActionButtons(
            List<DungeonRuntimeAction> actions,
            Consumer<DungeonRuntimeAction> onActionSelected
    ) {
        getChildren().add(sectionTitle("Aktionen"));
        if (actions == null || actions.isEmpty()) {
            getChildren().add(text("—"));
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
            getChildren().add(button);
            if (action.description() != null && !action.description().isBlank()) {
                getChildren().add(text(action.description()));
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

    private static TextFlow exitLine(DungeonRuntimeExit exit) {
        Text prefix = new Text(exitDescriptionPrefix(exit) + " ");
        prefix.setStyle("-fx-fill: -sm-text-muted;");

        Text description = new Text(valueOrDash(exit.description()));
        description.setStyle("-fx-fill: -sm-text-primary;");
        TextFlow flow = new TextFlow(prefix, description);
        flow.setLineSpacing(2);
        return flow;
    }

    private static String exitDescriptionPrefix(DungeonRuntimeExit exit) {
        String destination = exit.destinationLabel();
        if (destination == null || destination.isBlank()) {
            return "[" + exit.number() + "]";
        }
        return "[" + exit.number() + ": " + destination + "]";
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
