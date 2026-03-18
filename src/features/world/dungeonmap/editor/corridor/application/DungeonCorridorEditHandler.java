package features.world.dungeonmap.editor.corridor.application;

import features.world.dungeonmap.editor.edit.application.DungeonEditCommandHandler;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonCorridorEditHandler implements DungeonEditCommandHandler<DungeonEditorEditCommand> {

    private final DungeonCorridorCommandService corridorCommandService;

    public DungeonCorridorEditHandler(DungeonCorridorCommandService corridorCommandService) {
        this.corridorCommandService = Objects.requireNonNull(corridorCommandService, "corridorCommandService");
    }

    @Override
    public DungeonLayoutEditResult execute(Connection conn, long mapId, DungeonEditorEditCommand command) throws SQLException {
        return switch (command) {
            case DungeonEditorEditCommand.CreateCorridor edit ->
                    corridorCommandService.createCorridor(conn, mapId, edit.roomIds());
            case DungeonEditorEditCommand.AddRoomToCorridor edit ->
                    corridorCommandService.addRoomToCorridor(conn, mapId, edit.corridorId(), edit.roomId());
            case DungeonEditorEditCommand.MergeCorridors edit ->
                    corridorCommandService.mergeCorridors(conn, mapId, edit.keptCorridorId(), edit.mergedCorridorId());
            case DungeonEditorEditCommand.RemoveRoomFromCorridors edit ->
                    corridorCommandService.removeRoomFromCorridors(conn, mapId, edit.corridorIds(), edit.roomId());
            case DungeonEditorEditCommand.DeleteCorridor edit ->
                    corridorCommandService.deleteCorridor(conn, mapId, edit.corridorId());
            default -> throw new IllegalArgumentException(
                    "DungeonCorridorEditHandler.execute(): unbekannter Befehl: " + command.getClass().getSimpleName());
        };
    }
}
