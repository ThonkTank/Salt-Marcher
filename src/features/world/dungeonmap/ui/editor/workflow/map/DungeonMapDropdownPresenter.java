package features.world.dungeonmap.ui.editor.workflow.map;

import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.projection.DungeonMapState;
import javafx.scene.Node;

import java.util.function.Consumer;

public final class DungeonMapDropdownPresenter {

    private final DungeonMapFormDropdown mapFormDropdown = new DungeonMapFormDropdown();
    private final DungeonMapImpactPreviewService impactPreviewService = new DungeonMapImpactPreviewService();

    public void showNewMapDropdown(Node anchor, Consumer<DungeonMapFormDropdown.Result> onCreateRequested) {
        mapFormDropdown.showCreate(anchor, result -> {
            mapFormDropdown.hide();
            onCreateRequested.accept(result);
        });
    }

    public void showEditMapDropdown(
            Node anchor,
            DungeonMap map,
            DungeonMapState currentState,
            Consumer<DungeonMapFormDropdown.Result> onUpdateRequested,
            Runnable onDeleteRequested
    ) {
        mapFormDropdown.showEdit(anchor, map,
                (newWidth, newHeight) -> impactPreviewService.shrinkImpactText(map, currentState, newWidth, newHeight),
                () -> impactPreviewService.deleteImpactText(map, currentState),
                result -> {
            mapFormDropdown.hide();
            onUpdateRequested.accept(result);
        }, () -> {
            mapFormDropdown.hide();
            onDeleteRequested.run();
        });
    }
}
