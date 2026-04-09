package features.world.dungeonclean.editor;

import features.world.dungeonclean.editor.input.ComposeEditorInput;
import features.world.dungeonclean.editor.input.ViewsInput;

import java.util.Objects;

/**
 * Public clean editor owner seam for the current parallel workspace surface.
 */
@SuppressWarnings("unused")
public final class EditorObject {

    private final ViewsInput views;

    public EditorObject(ComposeEditorInput input) {
        ComposeEditorInput resolvedInput = Objects.requireNonNull(input, "input");
        java.util.concurrent.Callable<ComposeEditorInput.StatusSnapshot> statusLoader =
                Objects.requireNonNull(resolvedInput.statusLoader(), "statusLoader");

        javafx.scene.control.Label summaryLabel = new javafx.scene.control.Label(
                "Die saubere Dungeon-App laeuft separat und spiegelt aktuell den cluster-room-tail.");
        summaryLabel.setWrapText(true);

        javafx.scene.control.Label countsLabel = new javafx.scene.control.Label("Noch nicht geladen.");
        countsLabel.setWrapText(true);

        javafx.scene.control.Label statusLabel = new javafx.scene.control.Label("Bereit.");
        statusLabel.setWrapText(true);

        javafx.scene.control.Button refreshButton = new javafx.scene.control.Button("Cluster-Status laden");
        refreshButton.setMaxWidth(Double.MAX_VALUE);
        refreshButton.setOnAction(event -> {
            try {
                ComposeEditorInput.StatusSnapshot snapshot = statusLoader.call();
                countsLabel.setText(
                        "Persistierte Room-Tables:\n"
                                + "rooms=" + snapshot.roomCount() + "\n"
                                + "room_levels=" + snapshot.roomLevelCount() + "\n"
                                + "room_exit_descriptions=" + snapshot.roomNarrationCount());
                statusLabel.setText(
                        snapshot.errorMessage() == null || snapshot.errorMessage().isBlank()
                                ? "DB-Status erfolgreich geladen."
                                : snapshot.errorMessage());
            } catch (Exception exception) {
                countsLabel.setText("DB-Zugriff fehlgeschlagen.");
                statusLabel.setText("Fehler beim Laden des Cluster-Status: " + exception.getMessage());
            }
        });

        javafx.scene.layout.VBox controls = new javafx.scene.layout.VBox(10,
                new javafx.scene.control.Label("Dungeon Clean"),
                new javafx.scene.control.Label("Paralleler Neuaufbau ohne Legacy-Verkabelung."),
                refreshButton);
        controls.setFillWidth(true);
        controls.setPadding(new javafx.geometry.Insets(12));

        javafx.scene.layout.VBox main = new javafx.scene.layout.VBox(14,
                new javafx.scene.control.Label("Dungeon Clean Workspace"),
                summaryLabel,
                new javafx.scene.control.Label(
                        "Implementiert und sichtbar ist derzeit der clean cluster owner mit eigenem read/write seam."),
                countsLabel);
        main.setPadding(new javafx.geometry.Insets(16));

        javafx.scene.layout.VBox state = new javafx.scene.layout.VBox(10,
                new javafx.scene.control.Label("Status"),
                statusLabel,
                new javafx.scene.control.Label("Naechste Kandidaten fuer den Mirror: corridor, transition, map catalog."));
        state.setPadding(new javafx.geometry.Insets(12));

        ui.shell.AppView dungeonEditorView = new ui.shell.AppView() {
            @Override
            public javafx.scene.Node getMainContent() {
                return new javafx.scene.control.ScrollPane(main);
            }

            @Override
            public String getTitle() {
                return "Dungeon Clean";
            }

            @Override
            public String getIconText() {
                return "DC";
            }

            @Override
            public javafx.scene.Node getControlsContent() {
                return controls;
            }

            @Override
            public javafx.scene.Node getStateContent() {
                return state;
            }
        };

        this.views = new ViewsInput(dungeonEditorView);
    }

    public ViewsInput composeEditor(ComposeEditorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return views;
    }

    public ViewsInput views(ViewsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return views;
    }
}
