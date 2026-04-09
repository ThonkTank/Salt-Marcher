package features.world.dungeonclean.editor;

import features.world.dungeonclean.editor.input.ComposeWorkspaceInput;

import java.util.Objects;

/**
 * Public clean editor owner seam for the current parallel workspace surface.
 */
@SuppressWarnings("unused")
public final class EditorObject {

    private final ComposeWorkspaceInput.WorkspaceInput workspace;

    public EditorObject(ComposeWorkspaceInput input) {
        ComposeWorkspaceInput resolvedInput = Objects.requireNonNull(input, "input");
        java.util.concurrent.Callable<ComposeWorkspaceInput.StatusSnapshot> statusLoader =
                Objects.requireNonNull(resolvedInput.statusLoader(), "statusLoader");

        javafx.scene.control.Label summaryLabel = new javafx.scene.control.Label(
                "Die saubere Dungeon-App laeuft separat und spiegelt aktuell den cluster-room-tail.");
        summaryLabel.setWrapText(true);

        javafx.scene.control.Label countsLabel = new javafx.scene.control.Label("Noch nicht geladen.");
        countsLabel.setWrapText(true);

        javafx.scene.control.Label statusLabel = new javafx.scene.control.Label("Bereit.");
        statusLabel.setWrapText(true);
        javafx.scene.control.Label toolbarStatusLabel = new javafx.scene.control.Label("Bereit.");
        toolbarStatusLabel.getStyleClass().add("text-muted");

        javafx.scene.control.Button refreshButton = new javafx.scene.control.Button("Cluster-Status laden");
        refreshButton.setOnAction(event -> {
            try {
                ComposeWorkspaceInput.StatusSnapshot snapshot = statusLoader.call();
                countsLabel.setText(
                        "Persistierte Room-Tables:\n"
                                + "rooms=" + snapshot.roomCount() + "\n"
                                + "room_levels=" + snapshot.roomLevelCount() + "\n"
                                + "room_exit_descriptions=" + snapshot.roomNarrationCount());
                String statusMessage = snapshot.errorMessage() == null || snapshot.errorMessage().isBlank()
                        ? "DB-Status erfolgreich geladen."
                        : snapshot.errorMessage();
                statusLabel.setText(statusMessage);
                toolbarStatusLabel.setText(statusMessage);
            } catch (Exception exception) {
                countsLabel.setText("DB-Zugriff fehlgeschlagen.");
                String errorMessage = "Fehler beim Laden des Cluster-Status: " + exception.getMessage();
                statusLabel.setText(errorMessage);
                toolbarStatusLabel.setText(errorMessage);
            }
        });
        javafx.scene.layout.HBox toolbarContent = new javafx.scene.layout.HBox(10, refreshButton, toolbarStatusLabel);
        toolbarContent.setAlignment(javafx.geometry.Pos.CENTER_LEFT);

        javafx.scene.layout.VBox controls = new javafx.scene.layout.VBox(10,
                new javafx.scene.control.Label("Dungeon Clean"),
                new javafx.scene.control.Label("Paralleler Neuaufbau ohne Legacy-Verkabelung."),
                new javafx.scene.control.Label("Toolbar-Aktion: Cluster-Status laden."));
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

        this.workspace = new ComposeWorkspaceInput.WorkspaceInput(
                "dungeonclean-editor",
                "Dungeon Clean",
                "DC",
                toolbarContent,
                controls,
                new javafx.scene.control.ScrollPane(main),
                null,
                state,
                null,
                null);
    }

    public ComposeWorkspaceInput.WorkspaceInput composeWorkspace(ComposeWorkspaceInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return workspace;
    }
}
