package features.world.dungeonmap.editor.corridor.application;

import features.world.dungeonmap.editor.edit.application.DungeonEditCommandHandler;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonCorridorDetailEditHandler implements DungeonEditCommandHandler<DungeonEditorEditCommand> {

    private final DungeonCorridorDetailEditService corridorDetailEditService;

    public DungeonCorridorDetailEditHandler(DungeonCorridorDetailEditService corridorDetailEditService) {
        this.corridorDetailEditService = Objects.requireNonNull(corridorDetailEditService, "corridorDetailEditService");
    }

    @Override
    public DungeonLayoutEditResult execute(Connection conn, long mapId, DungeonEditorEditCommand command) throws SQLException {
        return switch (command) {
            case DungeonEditorEditCommand.MoveCorridorDoor edit ->
                    corridorDetailEditService.moveCorridorDoor(conn, mapId, edit.corridorId(), edit.roomId(), edit.cell(), edit.direction());
            case DungeonEditorEditCommand.ResetCorridorDoor edit ->
                    corridorDetailEditService.resetCorridorDoor(conn, mapId, edit.corridorId(), edit.roomId());
            case DungeonEditorEditCommand.AddCorridorWaypoint edit ->
                    corridorDetailEditService.addCorridorWaypoint(conn, mapId, edit.corridorId(), edit.insertIndex(), edit.cell());
            case DungeonEditorEditCommand.MoveCorridorWaypoint edit ->
                    corridorDetailEditService.moveCorridorWaypoint(conn, mapId, edit.corridorId(), edit.waypointIndex(), edit.cell());
            case DungeonEditorEditCommand.DeleteCorridorWaypoint edit ->
                    corridorDetailEditService.deleteCorridorWaypoint(conn, mapId, edit.corridorId(), edit.waypointIndex());
            default -> throw new IllegalArgumentException(
                    "DungeonCorridorDetailEditHandler.execute(): unbekannter Befehl: " + command.getClass().getSimpleName());
        };
    }
}
