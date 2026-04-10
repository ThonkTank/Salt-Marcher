package features.world.dungeon.shell.runtime;

import features.world.dungeon.application.runtime.DungeonRuntimeAction;
import features.world.dungeon.application.runtime.description.DungeonRuntimeDescription;
import features.world.dungeon.application.runtime.description.DungeonRuntimeExit;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonRuntimeDescriptionPane extends VBox {

    public DungeonRuntimeDescriptionPane(
            DungeonRuntimeDescription description,
            List<DungeonRuntimeAction> actions,
            Consumer<DungeonRuntimeAction> onActionSelected
    ) {
        super(8);
        setPadding(new Insets(12));
        if (description == null) {
            getChildren().add(text("Keine Beschreibung verfügbar"));
            return;
        }
        getChildren().addAll(
                sectionTitle("Beschreibung"),
                text(valueOrDash(description.description())));
        getChildren().add(sectionTitle("Durchgänge"));
        if (description.exits().isEmpty()) {
            getChildren().add(text("—"));
        } else {
            for (DungeonRuntimeExit exit : description.exits()) {
                getChildren().add(exitLine(exit));
            }
        }
        appendActionButtons(actions, onActionSelected);
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

    private static HBox exitLine(DungeonRuntimeExit exit) {
        Label prefix = new Label(exitDescriptionPrefix(exit));
        prefix.getStyleClass().add("text-muted");

        Label description = text(valueOrDash(exit.description()));
        description.setMaxWidth(Double.MAX_VALUE);

        HBox row = new HBox(6, prefix, description);
        row.setAlignment(Pos.TOP_LEFT);
        HBox.setHgrow(description, Priority.ALWAYS);
        return row;
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
