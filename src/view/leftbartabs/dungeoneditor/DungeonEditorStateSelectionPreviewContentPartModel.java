package src.view.leftbartabs.dungeoneditor;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;

final class DungeonEditorStateSelectionPreviewContentPartModel {

    String stateTextFor(DungeonEditorPreparedFrameFacts.StatePanelFrame frame) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        return "Werkzeug: " + safeFrame.selectedToolLabel()
                + "\nAnsicht: " + normalizeViewModeKey(safeFrame.viewModeLabel())
                + "\nEbene: z=" + safeFrame.projectionLevel()
                + "\n" + safeFrame.overlayLabel()
                + "\n" + selectionTextFor(SelectionData.from(safeFrame.selectionTopologyRef()), safeFrame.inspector())
                + "\n" + previewTextFor(safeFrame.preview());
    }

    private static String selectionTextFor(
            SelectionData selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (selection.isEmpty()) {
            return "Auswahl: Keine";
        }
        String selectionLabel = inspector != null && !inspector.title().isBlank()
                ? inspector.title()
                : selection.kind();
        return "Auswahl: " + selectionLabel + " (" + selection.kind() + " " + selection.id() + ")";
    }

    private static String previewTextFor(DungeonEditorPreview preview) {
        if (preview == null || preview instanceof DungeonEditorPreview.NonePreview) {
            return "Topologie-Preview: inaktiv";
        }
        if (preview instanceof DungeonEditorPreview.StairCreatePreview stairCreatePreview) {
            return "Topologie-Preview: "
                    + stairShapeLabel(stairCreatePreview.shapeName())
                    + " bei q=" + stairCreatePreview.anchor().q()
                    + ", r=" + stairCreatePreview.anchor().r()
                    + ", z=" + stairCreatePreview.anchor().level();
        }
        if (preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview) {
            return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                    + ", dr=" + movePreview.deltaR()
                    + ", dz=" + movePreview.deltaLevel();
        }
        if (preview instanceof DungeonEditorPreview.RoomRectanglePreview roomRectangle) {
            return "Topologie-Preview: "
                    + roomRectangleLabel(roomRectangle.deleteMode())
                    + " z=" + roomRectangle.start().level();
        }
        if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaries) {
            return "Topologie-Preview: "
                    + (boundaries.deleteMode() ? "Kanten löschen" : "Kanten setzen")
                    + " (" + boundaries.edges().size() + ")";
        }
        if (preview instanceof DungeonEditorPreview.MoveBoundaryStretchPreview stretch) {
            return "Topologie-Preview: Wandstrecke verschieben dq=" + stretch.deltaQ()
                    + ", dr=" + stretch.deltaR()
                    + ", dz=" + stretch.deltaLevel()
                    + " (" + stretch.sourceEdges().size() + ")";
        }
        return "Topologie-Preview: aktiv";
    }

    private static String stairShapeLabel(String shapeName) {
        return switch (shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT)) {
            case "SQUARE" -> "Eckspirale";
            case "CIRCULAR" -> "Rundspirale";
            default -> "Gerade";
        };
    }

    private static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return "Graph".equals(viewModeKey) ? "Graph" : "Grid";
    }

    private static String roomRectangleLabel(boolean deleteMode) {
        return deleteMode ? "Raum löschen" : "Raum malen";
    }

    private record SelectionData(String kind, long id) {
        SelectionData {
            kind = kind == null ? "EMPTY" : kind;
            id = Math.max(0L, id);
        }

        private static SelectionData from(DungeonEditorTopologyElementRef topologyRef) {
            DungeonEditorTopologyElementRef safeTopologyRef = topologyRef == null
                    ? DungeonEditorTopologyElementRef.empty()
                    : topologyRef;
            return new SelectionData(safeTopologyRef.kind(), safeTopologyRef.id());
        }

        private boolean isEmpty() {
            return "EMPTY".equals(kind);
        }
    }
}
