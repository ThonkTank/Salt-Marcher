package features.world.quarantine.dungeonmap.editor.shell;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

public interface DungeonEditorUiFeedback {

    void onLayoutChanged(DungeonLayout layout);

    void onSelectionChanged();

    void onStatePaneChanged();

    void onReloadRequested(Long preferredMapId);
}
