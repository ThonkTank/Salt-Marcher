package clean.featuretabs.tablestab;

import clean.featuretabs.tablestab.input.ComposeTablestabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Top-level clean placeholder surface for tables.
 */
@SuppressWarnings("unused")
public final class TablestabObject {

    private final ComposeTablestabInput.TablestabInput tablestab;

    public TablestabObject(ComposeTablestabInput input) {
        ComposeTablestabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.tablestab = new TablestabAssembly(resolvedInput).composeTablestab();
    }

    public ComposeTablestabInput.TablestabInput composeTablestab(ComposeTablestabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return tablestab;
    }

    private static final class TablestabAssembly {

        private final ComposeTablestabInput input;

        private TablestabAssembly(ComposeTablestabInput input) {
            this.input = input;
        }

        private ComposeTablestabInput.TablestabInput composeTablestab() {
            return new ComposeTablestabInput.TablestabInput(new ComposeShellInput.SurfaceInput(
                    "tables",
                    "Tabellen",
                    "editor",
                    "Ta",
                    input.navigationGraphic(),
                    null,
                    createControls(),
                    createMain(),
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
                    createMutedLabel("Tabellen ist als eigener Clean-Editor-Slot vorbereitet."),
                    createMutedLabel("Workspace, Filter und Tabellenwerkzeuge folgen spaeter.")
            );
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static Node createMain() {
            VBox main = new VBox(
                    12,
                    createTitleLabel("Tabellen"),
                    createMutedLabel("Der Clean-Shell-Slice reserviert diesen Surface fuer die Tabellenbearbeitung."),
                    createMutedLabel("Die eigentliche Tabellenfunktion wird spaeter lokal in Clean neu aufgebaut.")
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
