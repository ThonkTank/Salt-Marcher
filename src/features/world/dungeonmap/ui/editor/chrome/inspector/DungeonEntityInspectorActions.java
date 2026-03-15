package features.world.dungeonmap.ui.editor.chrome.inspector;

import features.world.dungeonmap.model.domain.DungeonFeature;
import javafx.scene.Node;

public interface DungeonEntityInspectorActions {

    void updateRoomMetadata(
            long roomId,
            String name,
            String lightLevel,
            String visualDescription,
            String soundsDescription,
            String smellsDescription,
            String otherDescription,
            String glanceDescription,
            String detailDescription,
            String reactiveChecks,
            String gmBackground
    );

    void openRoomEditor(Node anchor, long roomId);

    void openFeatureEditor(Node anchor, long featureId);

    void saveFeature(DungeonFeature feature);
}
