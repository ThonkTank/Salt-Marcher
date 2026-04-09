package features.world.dungeonclean;

import features.world.dungeonclean.input.ViewsInput;

/**
 * Public clean dungeon rebuild seam. Migrated capabilities live under clean child owners until a stable top-level
 * composition surface is warranted.
 */
@SuppressWarnings("unused")
public final class DungeoncleanObject {

    private final ViewsInput views;

    public DungeoncleanObject() {
        javafx.scene.control.Label statusLabel = new javafx.scene.control.Label(
                "Bereit. Die saubere Dungeon-Spur laeuft parallel zur Legacy-App.");
        statusLabel.setWrapText(true);

        javafx.scene.control.Label countsLabel = new javafx.scene.control.Label("Noch nicht geladen.");
        countsLabel.setWrapText(true);

        javafx.scene.control.Button refreshButton = new javafx.scene.control.Button("DB-Status laden");
        refreshButton.setMaxWidth(Double.MAX_VALUE);
        refreshButton.setOnAction(event -> {
            try (java.sql.Connection conn = database.DatabaseManager.getConnection();
                 java.sql.Statement stmt = conn.createStatement()) {
                long roomCount;
                long roomLevelCount;
                long roomNarrationCount;
                try (java.sql.ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM dungeon_rooms")) {
                    roomCount = rs.next() ? rs.getLong(1) : 0L;
                }
                try (java.sql.ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM dungeon_room_levels")) {
                    roomLevelCount = rs.next() ? rs.getLong(1) : 0L;
                }
                try (java.sql.ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM dungeon_room_exit_descriptions")) {
                    roomNarrationCount = rs.next() ? rs.getLong(1) : 0L;
                }
                countsLabel.setText(
                        "Persistierte Room-Tables:\n"
                                + "rooms=" + roomCount + "\n"
                                + "room_levels=" + roomLevelCount + "\n"
                                + "room_exit_descriptions=" + roomNarrationCount);
                statusLabel.setText("DB-Status erfolgreich geladen.");
            } catch (java.sql.SQLException exception) {
                countsLabel.setText("DB-Zugriff fehlgeschlagen.");
                statusLabel.setText("Fehler beim Laden des DB-Status: " + exception.getMessage());
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
                new javafx.scene.control.Label(
                        "Implementiert ist derzeit der erste echte Clean-Slice: cluster rewrite tail room persistence."),
                new javafx.scene.control.Label(
                        "Dieser Einstiegspunkt ist absichtlich separat von features.world.dungeon gehalten."),
                countsLabel);
        main.setPadding(new javafx.geometry.Insets(16));

        javafx.scene.layout.VBox state = new javafx.scene.layout.VBox(10,
                new javafx.scene.control.Label("Status"),
                statusLabel,
                new javafx.scene.control.Label("Naechster geplanter Slice: corridor oder transition."));
        state.setPadding(new javafx.geometry.Insets(12));

        ui.shell.AppView cleanView = new ui.shell.AppView() {
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

        this.views = new ViewsInput(cleanView);
    }

    public ViewsInput views(ViewsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return views;
    }
}
