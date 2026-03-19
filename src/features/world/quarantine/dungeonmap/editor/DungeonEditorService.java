package features.world.quarantine.dungeonmap.editor;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.layout.persistence.DungeonLayoutReadRepository;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Public facade for dungeon editor read/write workflows.
 */
public final class DungeonEditorService {

    @FunctionalInterface
    public interface PostEditHook {
        void run(Connection conn) throws SQLException;
    }

    private final DungeonConnectionFactory connectionFactory;
    private final DungeonEditorCommandRouter commandRouter;
    private final PostEditHook postEditHook;

    public DungeonEditorService(
            DungeonConnectionFactory connectionFactory,
            DungeonRoomTopologyCoordinator roomTopologyCoordinator,
            DungeonCorridorCommandService corridorCommandService,
            DungeonCorridorDetailEditService corridorDetailEditService,
            PostEditHook postEditHook
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.commandRouter = new DungeonEditorCommandRouter(
                Objects.requireNonNull(roomTopologyCoordinator, "roomTopologyCoordinator"),
                Objects.requireNonNull(corridorCommandService, "corridorCommandService"),
                Objects.requireNonNull(corridorDetailEditService, "corridorDetailEditService")
        );
        this.postEditHook = Objects.requireNonNull(postEditHook, "postEditHook");
    }

    public DungeonLayout loadLayout(long mapId) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonLayoutReadRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
        }
    }

    public DungeonLayoutEditResult applyEdit(long mapId, DungeonEditorEditCommand command) throws SQLException {
        Objects.requireNonNull(command, "command");
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonTransactionSupport.inTransaction(conn, () -> {
                DungeonLayoutEditResult result = commandRouter.route(conn, mapId, command);
                // Persisted layout and stored runtime location must commit as one invariant.
                postEditHook.run(conn);
                return result;
            });
        }
    }
}
