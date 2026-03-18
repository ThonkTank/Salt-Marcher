package features.world.dungeonmap.editor.edit.application;

import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.sql.Connection;
import java.sql.SQLException;

public interface DungeonEditCommandHandler<C extends DungeonEditorEditCommand> {
    DungeonLayoutEditResult execute(Connection conn, long mapId, C command) throws SQLException;
}
