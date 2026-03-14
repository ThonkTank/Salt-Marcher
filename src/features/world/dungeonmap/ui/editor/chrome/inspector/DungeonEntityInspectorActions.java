package features.world.dungeonmap.ui.editor.chrome.inspector;

import features.world.dungeonmap.model.domain.DungeonFeature;
import javafx.scene.Node;

public interface DungeonEntityInspectorActions {

    void updateRoomMetadata(
            long roomId,
            String name,
            String glanceDescription,
            String detailDescription,
            String reactiveChecks,
            String gmBackground
    );

    void openRoomEditor(Node anchor, long roomId);

    void saveFeature(DungeonFeature feature);
}
