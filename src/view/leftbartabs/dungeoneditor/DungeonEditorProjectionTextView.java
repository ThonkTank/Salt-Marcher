package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.OverlayProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.RoomExitNarrationProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.RoomNarrationCardProjection;

final class ProjectionTextSupport {

    private ProjectionTextSupport() {
    }

    static String stateTextFor(
            ProjectionSource source,
            OverlayProjection overlayProjection,
            String selectedToolLabel,
            String viewModeLabel,
            int projectionLevel
    ) {
        return "Werkzeug: " + selectedToolLabel
                + "\nAnsicht: " + viewModeLabel
                + "\nEbene: z=" + projectionLevel
                + "\n" + overlayProjection.overlayLabel()
                + "\n" + selectionTextFor(source.selection(), source.inspector())
                + "\n" + previewTextFor(source.preview());
    }

    static List<RoomNarrationCardProjection> toNarrationCards(
            @Nullable DungeonEditorInspectorSnapshot inspector
    ) {
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> new RoomNarrationCardProjection(
                        card.roomId(),
                        card.roomName(),
                        card.visualDescription(),
                        card.exits().stream()
                                .map(exit -> new RoomExitNarrationProjection(
                                        exit.label(),
                                        exit.cell().q(),
                                        exit.cell().r(),
                                        exit.cell().level(),
                                        exit.direction(),
                                        exit.description()))
                                .toList()))
                .toList();
    }

    private static String selectionTextFor(
            ProjectionSource.SelectionData selection,
            @Nullable DungeonEditorInspectorSnapshot inspector
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
        if (preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview) {
            return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                    + ", dr=" + movePreview.deltaR()
                    + ", dz=" + movePreview.deltaLevel();
        }
        if (preview instanceof DungeonEditorPreview.RoomRectanglePreview roomRectangle) {
            return "Topologie-Preview: "
                    + ToolCatalog.roomRectangleLabel(roomRectangle.deleteMode())
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
}
