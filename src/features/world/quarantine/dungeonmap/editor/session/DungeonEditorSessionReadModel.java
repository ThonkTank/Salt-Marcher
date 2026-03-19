package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

public interface DungeonEditorSessionReadModel {

    DungeonLayout currentLayout();

    Long sessionMapId();

    Long activeEditSessionId();

    boolean editingEnabled();
}
