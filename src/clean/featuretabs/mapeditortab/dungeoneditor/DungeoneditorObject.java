package clean.featuretabs.mapeditortab.dungeoneditor;

import clean.featuretabs.mapeditortab.dungeoneditor.input.ComposeDungeoneditorInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Clean placeholder editor surface for dungeon editing.
 */
public final class DungeoneditorObject {

    private final ComposeDungeoneditorInput.DungeoneditorInput dungeoneditor;

    public DungeoneditorObject(ComposeDungeoneditorInput input) {
        ComposeDungeoneditorInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.dungeoneditor = new DungeoneditorAssembly(resolvedInput).composeDungeoneditor();
    }

    public ComposeDungeoneditorInput.DungeoneditorInput composeDungeoneditor(ComposeDungeoneditorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return dungeoneditor;
    }

    private static final class DungeoneditorAssembly {

        private final ComposeDungeoneditorInput input;

        private DungeoneditorAssembly(ComposeDungeoneditorInput input) {
            this.input = input;
        }

        private ComposeDungeoneditorInput.DungeoneditorInput composeDungeoneditor() {
            Label title = new Label("Map Editor: Dungeon");
            title.getStyleClass().add("heading");

            Label mapLabel = createMutedLabel("Aktive Karte: " + normalizeText(input.map().title()));
            Label summaryLabel = createMutedLabel(normalizeText(input.map().summary()));
            Label noteLabel = createMutedLabel(
                    "Der Editor-Surface hat automatisch auf den Dungeon-Unter-View gewechselt. Editor-Logik folgt spaeter.");

            VBox main = new VBox(12, title, mapLabel, summaryLabel, noteLabel);
            main.setPadding(new Insets(12));
            return new ComposeDungeoneditorInput.DungeoneditorInput(main);
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
