package features.world.dungeonmap.ui.editor.workflow.map;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.service.preview.DungeonMapImpactPreviewService;
import features.world.dungeonmap.ui.editor.dropdowns.DungeonMapFormDropdown;
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
