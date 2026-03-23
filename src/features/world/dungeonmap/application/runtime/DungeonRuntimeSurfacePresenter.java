package features.world.dungeonmap.application.runtime;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;

import java.util.function.Consumer;

public final class DungeonRuntimeSurfacePresenter {

    private DungeonRuntimeSurfacePresenter() {
        throw new AssertionError("No instances");
    }

    public static Node buildNode(
            DungeonRuntimeSurface surface,
            Consumer<DungeonRuntimeStairDescriptor> onStairSelected,
            Consumer<DungeonRuntimeTransitionDescriptor> onTransitionSelected
    ) {
        VBox box = new VBox(8);
        box.setPadding(new Insets(12));
        if (surface == null) {
            box.getChildren().add(text("Keine Beschreibung verfügbar"));
            return box;
        }
        VBox descriptionBlock = new VBox(2);
        descriptionBlock.getChildren().add(text(valueOrDash(surface.visualDescription())));
        if (!surface.doors().isEmpty()) {
            descriptionBlock.getChildren().add(sectionTitle("Durchgänge"));
            for (DungeonRuntimeDoorDescriptor door : surface.doors()) {
                descriptionBlock.getChildren().add(doorLine(door));
            }
        }
        box.getChildren().addAll(
                sectionTitle("Visueller Eindruck"),
                descriptionBlock);
        box.getChildren().add(sectionTitle("Treppen"));
        if (surface.stairs().isEmpty()) {
            box.getChildren().add(text("—"));
        } else {
            for (DungeonRuntimeStairDescriptor stair : surface.stairs()) {
                Button button = new Button(stair.displayLabel());
                button.setMaxWidth(Double.MAX_VALUE);
                button.setOnAction(event -> {
                    if (onStairSelected != null) {
                        onStairSelected.accept(stair);
                    }
                });
                box.getChildren().add(button);
                if (stair.description() != null && !stair.description().isBlank()) {
                    box.getChildren().add(text(stair.description()));
                }
            }
        }
        box.getChildren().add(sectionTitle("Übergänge"));
        if (surface.transitions().isEmpty()) {
            box.getChildren().add(text("—"));
        } else {
            for (DungeonRuntimeTransitionDescriptor transition : surface.transitions()) {
                Button button = new Button(transition.displayLabel());
                button.setMaxWidth(Double.MAX_VALUE);
                button.setOnAction(event -> {
                    if (onTransitionSelected != null) {
                        onTransitionSelected.accept(transition);
                    }
                });
                box.getChildren().add(button);
                if (transition.description() != null && !transition.description().isBlank()) {
                    box.getChildren().add(text(transition.description()));
                }
            }
        }
        return box;
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

    private static TextFlow doorLine(DungeonRuntimeDoorDescriptor door) {
        Text prefix = new Text(doorDescriptionPrefix(door) + " ");
        prefix.setStyle("-fx-fill: -sm-text-muted;");

        Text description = new Text(valueOrDash(door.description()));
        description.setStyle("-fx-fill: -sm-text-primary;");
        TextFlow flow = new TextFlow(prefix, description);
        flow.setLineSpacing(2);
        return flow;
    }

    private static String doorDescriptionPrefix(DungeonRuntimeDoorDescriptor door) {
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
