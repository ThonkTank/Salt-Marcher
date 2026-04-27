package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class DungeonEditorIntentHandler {

    private final DungeonEditorPresentationModel presentationModel;
    private Consumer<DungeonEditorPresentationModel.ActionIntent> actionListener = ignored -> {};

    DungeonEditorIntentHandler(DungeonEditorPresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onActionRequested(Consumer<DungeonEditorPresentationModel.ActionIntent> listener) {
        actionListener = listener == null ? ignored -> {} : listener;
    }

    void refresh() {
        dispatch(presentationModel.refresh());
    }

    void selectMap(String mapKey) {
        dispatch(presentationModel.selectMap(mapKey));
    }

    void createMap(String mapName) {
        dispatch(presentationModel.createMap(mapName));
    }

    void renameMap(String mapKey, String mapName) {
        dispatch(presentationModel.renameMap(mapKey, mapName));
    }

    void deleteMap(String mapKey) {
        dispatch(presentationModel.deleteMap(mapKey));
    }

    void selectViewMode(String viewModeKey) {
        presentationModel.selectViewMode(viewModeKey);
    }

    void selectTool(String nextTool) {
        presentationModel.selectTool(nextTool);
    }

    void previousLevel() {
        presentationModel.previousLevel();
    }

    void levelScrolled(int delta) {
        dispatch(presentationModel.levelScrolled(delta));
    }

    void nextLevel() {
        presentationModel.nextLevel();
    }

    void selectOverlayMode(String overlayModeKey) {
        presentationModel.selectOverlayMode(overlayModeKey);
    }

    void selectOverlayRange(int levelRange) {
        presentationModel.selectOverlayRange(levelRange);
    }

    void selectOverlayOpacity(double opacity) {
        presentationModel.selectOverlayOpacity(opacity);
    }

    void selectOverlayLevels(List<Integer> levels) {
        presentationModel.selectOverlayLevels(levels);
    }

    boolean primaryPressed(DungeonEditorPresentationModel.PointerInput input) {
        DungeonEditorPresentationModel.InteractionResult result = presentationModel.primaryPressed(input);
        dispatch(result.action());
        return result.consumed();
    }

    void primaryDragged(DungeonEditorPresentationModel.PointerInput input) {
        dispatch(presentationModel.primaryDragged(input));
    }

    void primaryReleased(DungeonEditorPresentationModel.PointerInput input) {
        dispatch(presentationModel.primaryReleased(input));
    }

    void pointerMoved(DungeonEditorPresentationModel.PointerInput input) {
        presentationModel.pointerMoved(input);
    }

    void saveRoomNarration(
            long roomId,
            String visualDescription,
            List<DungeonEditorPresentationModel.RoomExitNarrationInput> exits
    ) {
        dispatch(presentationModel.saveRoomNarration(roomId, visualDescription, exits));
    }

    private void dispatch(DungeonEditorPresentationModel.@Nullable ActionIntent action) {
        if (action != null) {
            actionListener.accept(action);
        }
    }
}
