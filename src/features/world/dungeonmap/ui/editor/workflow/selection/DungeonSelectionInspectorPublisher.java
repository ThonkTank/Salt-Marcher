package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.editing.DungeonSelection;
import features.world.dungeonmap.ui.editor.inspector.DungeonEditorInspectorContentFactory;
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
            case ENDPOINT -> showEndpointInspector(selection.endpoint(), refreshOnlyIfVisible);
            case LINK -> showLinkInspector(selection.link(), refreshOnlyIfVisible);
            case PASSAGE -> showPassageInspector(selection.passage(), refreshOnlyIfVisible);
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
        detailsNavigator.showContent(titleOrFallback(room.name(), "Raum"), entryKey, () -> inspectorContentFactory.buildRoomCard(room));
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
        Object entryKey = featureEntryKey(feature.featureId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(
                titleOrFallback(feature.name(), feature.category() == null ? "Feature" : feature.category().label()),
                entryKey,
                () -> inspectorContentFactory.buildFeatureCard(feature));
    }

    private void showEndpointInspector(DungeonEndpoint endpoint, boolean refreshOnlyIfVisible) {
        if (endpoint == null || endpoint.endpointId() == null) {
            return;
        }
        Object entryKey = endpointEntryKey(endpoint.endpointId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(titleOrFallback(endpoint.name(), "Übergang"), entryKey, () -> inspectorContentFactory.buildEndpointCard(endpoint));
    }

    private void showLinkInspector(DungeonLink link, boolean refreshOnlyIfVisible) {
        if (link == null || link.linkId() == null) {
            return;
        }
        Object entryKey = linkEntryKey(link.linkId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(titleOrFallback(link.label(), "Link"), entryKey, () -> inspectorContentFactory.buildLinkCard(link));
    }

    private void showPassageInspector(DungeonPassage passage, boolean refreshOnlyIfVisible) {
        if (passage == null || passage.passageId() == null) {
            return;
        }
        Object entryKey = passageEntryKey(passage.passageId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(titleOrFallback(passage.name(), "Durchgang"), entryKey, () -> inspectorContentFactory.buildPassageCard(passage));
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

    private static String featureEntryKey(Long featureId) {
        return "dungeon-editor-feature:" + featureId;
    }

    private static String endpointEntryKey(Long endpointId) {
        return "dungeon-editor-endpoint:" + endpointId;
    }

    private static String linkEntryKey(Long linkId) {
        return "dungeon-editor-link:" + linkId;
    }

    private static String passageEntryKey(Long passageId) {
        return "dungeon-editor-passage:" + passageId;
    }

    private static String titleOrFallback(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
