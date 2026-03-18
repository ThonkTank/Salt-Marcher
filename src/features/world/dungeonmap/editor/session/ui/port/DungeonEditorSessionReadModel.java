package features.world.dungeonmap.editor.session.ui.port;

import features.world.dungeonmap.layout.model.DungeonLayout;

public interface DungeonEditorSessionReadModel {

    DungeonLayout currentLayout();

    Long sessionMapId();

    Long activeEditSessionId();

    boolean editingEnabled();
}
