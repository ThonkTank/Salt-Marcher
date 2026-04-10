package clean.featuretabs.traveltab.dungeontravel;

import clean.featuretabs.traveltab.dungeontravel.input.ComposeDungeontravelInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Clean placeholder runtime surface for dungeon travel.
 */
public final class DungeontravelObject {

    private final ComposeDungeontravelInput.DungeontravelInput dungeontravel;

    public DungeontravelObject(ComposeDungeontravelInput input) {
        ComposeDungeontravelInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.dungeontravel = new DungeontravelAssembly(resolvedInput).composeDungeontravel();
    }

    public ComposeDungeontravelInput.DungeontravelInput composeDungeontravel(ComposeDungeontravelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return dungeontravel;
    }

    private static final class DungeontravelAssembly {

        private final ComposeDungeontravelInput input;

        private DungeontravelAssembly(ComposeDungeontravelInput input) {
            this.input = input;
        }

        private ComposeDungeontravelInput.DungeontravelInput composeDungeontravel() {
            Label title = new Label("Travel: Dungeon");
            title.getStyleClass().add("heading");

            Label mapLabel = createMutedLabel("Aktive Karte: " + normalizeText(input.map().title()));
            Label summaryLabel = createMutedLabel(normalizeText(input.map().summary()));
            Label noteLabel = createMutedLabel(
                    "Die Travel-Shell hat automatisch auf den Dungeon-Unter-View gewechselt. Runtime-Logik folgt spaeter.");

            VBox main = new VBox(12, title, mapLabel, summaryLabel, noteLabel);
            main.setPadding(new Insets(12));
            return new ComposeDungeontravelInput.DungeontravelInput(main);
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
