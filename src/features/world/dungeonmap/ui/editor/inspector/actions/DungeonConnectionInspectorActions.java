package features.world.dungeonmap.ui.editor.inspector.actions;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonPassage;
import javafx.scene.Node;

public interface DungeonConnectionInspectorActions {

    void saveEndpoint(DungeonEndpoint endpoint);

    void deleteEndpoint(Long endpointId, Node anchor);

    void savePassage(DungeonPassage passage);

    void deletePassage(Long passageId, Node anchor);

    void updateLinkLabel(long linkId, String label, Runnable onSuccess);

    void deleteLink(Long linkId);
}
