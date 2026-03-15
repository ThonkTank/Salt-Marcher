package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.ui.editor.chrome.inspector.DungeonEditorInspectorContentFactory;
import ui.shell.DetailsNavigator;

public final class DungeonSelectionInspectorPublisher {

    private final DetailsNavigator detailsNavigator;
    private final DungeonEditorInspectorContentFactory inspectorContentFactory;

    public DungeonSelectionInspectorPublisher(
            DetailsNavigator detailsNavigator,
            DungeonEditorInspectorContentFactory inspectorContentFactory
    ) {
        this.detailsNavigator = detailsNavigator;
        this.inspectorContentFactory = inspectorContentFactory;
    }

    public void showSelection(DungeonSelection selection) {
        publishSelection(selection, false);
    }

    public void refreshSelectionIfVisible(DungeonSelection selection) {
        publishSelection(selection, true);
    }

    private void publishSelection(DungeonSelection selection, boolean refreshOnlyIfVisible) {
        if (detailsNavigator == null || inspectorContentFactory == null || selection == null) {
            return;
        }
        switch (selection.type()) {
            case ROOM -> showRoomInspector(selection.room(), refreshOnlyIfVisible);
            case AREA -> showAreaInspector(selection.area(), refreshOnlyIfVisible);
            case FEATURE -> showFeatureInspector(selection.feature(), refreshOnlyIfVisible);
            case CONNECTION -> showConnectionInspector(selection.connection(), refreshOnlyIfVisible);
            case NONE -> {
                // Keep the last global inspector entry visible until the GM opens or closes it explicitly.
            }
            case SQUARE -> {
                // Empty/background square selection stays editor-local.
            }
        }
    }

    private void showRoomInspector(DungeonRoom room, boolean refreshOnlyIfVisible) {
        if (room == null || room.roomId() == null) {
            return;
        }
        Object entryKey = roomEntryKey(room.roomId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(
                titleOrFallback(room.name(), "Raum"),
                entryKey,
                () -> inspectorContentFactory.buildRoomCard(room),
                () -> inspectorContentFactory.buildRoomFooter(room));
    }

    private void showAreaInspector(DungeonArea area, boolean refreshOnlyIfVisible) {
        if (area == null || area.areaId() == null) {
            return;
        }
        Object entryKey = areaEntryKey(area.areaId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(titleOrFallback(area.name(), "Bereich"), entryKey, () -> inspectorContentFactory.buildAreaCard(area));
    }

    private void showFeatureInspector(DungeonFeature feature, boolean refreshOnlyIfVisible) {
        if (feature == null || feature.featureId() == null) {
            return;
        }
        DungeonRoom room = inspectorContentFactory.resolveOwningRoom(feature);
        if (room == null || room.roomId() == null) {
            return;
        }
        Object entryKey = roomEntryKey(room.roomId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(titleOrFallback(room.name(), "Raum"), entryKey, () -> inspectorContentFactory.buildRoomCard(room), () -> inspectorContentFactory.buildRoomFooter(room));
    }

    private void showConnectionInspector(DungeonConnection connection, boolean refreshOnlyIfVisible) {
        if (connection == null || connection.connectionId() == null) {
            return;
        }
        Object entryKey = connectionEntryKey(connection.connectionId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent("Verbindung", entryKey, () -> inspectorContentFactory.buildConnectionCard(connection));
    }

    private boolean isShowingContent(Object key) {
        return detailsNavigator.isShowing(new DetailsNavigator.EntryKey("content", key));
    }

    private static String roomEntryKey(Long roomId) {
        return "dungeon-editor-room:" + roomId;
    }

    private static String areaEntryKey(Long areaId) {
        return "dungeon-editor-area:" + areaId;
    }

    private static String connectionEntryKey(Long connectionId) {
        return "dungeon-editor-connection:" + connectionId;
    }

    private static String titleOrFallback(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
