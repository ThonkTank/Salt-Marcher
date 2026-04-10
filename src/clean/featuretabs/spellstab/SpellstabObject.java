package clean.featuretabs.spellstab;

import clean.featuretabs.spellstab.input.ComposeSpellstabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Top-level clean placeholder surface for spells.
 */
@SuppressWarnings("unused")
public final class SpellstabObject {

    private final ComposeSpellstabInput.SpellstabInput spellstab;

    public SpellstabObject(ComposeSpellstabInput input) {
        ComposeSpellstabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.spellstab = new SpellstabAssembly(resolvedInput).composeSpellstab();
    }

    public ComposeSpellstabInput.SpellstabInput composeSpellstab(ComposeSpellstabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return spellstab;
    }

    private static final class SpellstabAssembly {

        private final ComposeSpellstabInput input;

        private SpellstabAssembly(ComposeSpellstabInput input) {
            this.input = input;
        }

        private ComposeSpellstabInput.SpellstabInput composeSpellstab() {
            return new ComposeSpellstabInput.SpellstabInput(new ComposeShellInput.SurfaceInput(
                    "spells",
                    "Zauber",
                    "editor",
                    "Z",
                    input.navigationGraphic(),
                    null,
                    createControls(),
                    createMain(),
                    null,
                    null,
                    null,
                    null,
                    null
            ));
        }

        private static Node createControls() {
            VBox controls = new VBox(
                    8,
                    createSectionLabel("Editor"),
                    createMutedLabel("Zauber ist als eigener Clean-Katalogslot vorbereitet."),
                    createMutedLabel("Suche, Referenzdetails und Bearbeitung folgen spaeter.")
            );
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static Node createMain() {
            VBox main = new VBox(
                    12,
                    createTitleLabel("Zauber"),
                    createMutedLabel("Dieser Surface bleibt bewusst placeholder-only, bis die Clean-Zauberfunktion andockt."),
                    createMutedLabel("Die Shell-Integration ist bereits vollstaendig vorbereitet.")
            );
            main.setPadding(new Insets(12));
            return main;
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("subheading");
            return label;
        }

        private static Label createTitleLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("heading");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }
    }
}
