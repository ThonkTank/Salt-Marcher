package src.view.leftbartabs.dungeoneditor;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonEditorStateContentModel {
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final Map<VisualDraftKey, String> visualDrafts = new HashMap<>();
    private final Map<ExitDraftKey, String> exitDrafts = new HashMap<>();
    private StateProjectionContext currentContext = StateProjectionContext.empty();

    ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    void apply(
            @Nullable DungeonEditorStateSnapshot snapshot,
            StateProjectionContext context
    ) {
        DungeonEditorStateSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorStateSnapshot.empty("")
                : snapshot;
        StateProjectionContext safeContext = context == null
                ? StateProjectionContext.empty()
                : context;
        currentContext = safeContext;
        List<RoomNarrationCardProjection> narrationCards =
                ProjectionTextSupport.toNarrationCards(safeSnapshot.inspector());
        pruneDrafts(safeContext.selectedMapIdValue(), narrationCards);
        stateProjection.set(new StateProjection(
                ProjectionTextSupport.stateTextFor(safeSnapshot, safeContext),
                safeContext.statusText(),
                safeContext.busy(),
                applyDrafts(safeContext.selectedMapIdValue(), narrationCards)));
    }

    @Nullable RoomNarrationCardProjection currentNarrationCard(long roomId) {
        StateProjection currentProjection = stateProjection.get();
        StateProjection safeProjection = currentProjection == null
                ? StateProjection.initial()
                : currentProjection;
        for (RoomNarrationCardProjection card : safeProjection.narrationCards()) {
            if (card.roomId() == roomId) {
                return card;
            }
        }
        return null;
    }

    void updateNarrationDraft(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        RoomNarrationCardProjection card = currentNarrationCard(event.roomId());
        if (card == null) {
            return;
        }
        long selectedMapIdValue = currentContext.selectedMapIdValue();
        visualDrafts.put(new VisualDraftKey(selectedMapIdValue, card.roomId()), event.visualDescription());
        List<String> descriptions = event.exitDescriptions();
        List<RoomExitNarrationProjection> exits = card.exits();
        for (int index = 0; index < exits.size(); index++) {
            String description = index < descriptions.size() ? descriptions.get(index) : exits.get(index).description();
            exitDrafts.put(ExitDraftKey.from(selectedMapIdValue, card.roomId(), exits.get(index)), description);
        }
    }

    void clearNarrationDraft(long roomId) {
        long selectedMapIdValue = currentContext.selectedMapIdValue();
        visualDrafts.remove(new VisualDraftKey(selectedMapIdValue, roomId));
        exitDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue && key.roomId() == roomId);
    }

    String currentVisualDescription(RoomNarrationCardProjection card) {
        if (card == null) {
            return "";
        }
        return visualDrafts.getOrDefault(
                new VisualDraftKey(currentContext.selectedMapIdValue(), card.roomId()),
                card.visualDescription());
    }

    List<RoomExitNarrationProjection> currentExitsWithDraftDescriptions(RoomNarrationCardProjection card) {
        if (card == null) {
            return List.of();
        }
        long selectedMapIdValue = currentContext.selectedMapIdValue();
        return card.exits().stream()
                .map(exit -> exit.withDescription(exitDrafts.getOrDefault(
                        ExitDraftKey.from(selectedMapIdValue, card.roomId(), exit),
                        exit.description())))
                .toList();
    }

    private List<RoomNarrationCardProjection> applyDrafts(
            long selectedMapIdValue,
            List<RoomNarrationCardProjection> cards
    ) {
        return cards.stream()
                .map(card -> new RoomNarrationCardProjection(
                        card.roomId(),
                        card.roomName(),
                        visualDrafts.getOrDefault(
                                new VisualDraftKey(selectedMapIdValue, card.roomId()),
                                card.visualDescription()),
                        card.exits().stream()
                                .map(exit -> exit.withDescription(exitDrafts.getOrDefault(
                                        ExitDraftKey.from(selectedMapIdValue, card.roomId(), exit),
                                        exit.description())))
                                .toList()))
                .toList();
    }

    private void pruneDrafts(long selectedMapIdValue, List<RoomNarrationCardProjection> cards) {
        Set<VisualDraftKey> visibleVisuals = new HashSet<>();
        Set<ExitDraftKey> visibleExits = new HashSet<>();
        for (RoomNarrationCardProjection card : cards) {
            visibleVisuals.add(new VisualDraftKey(selectedMapIdValue, card.roomId()));
            for (RoomExitNarrationProjection exit : card.exits()) {
                visibleExits.add(ExitDraftKey.from(selectedMapIdValue, card.roomId(), exit));
            }
        }
        visualDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !visibleVisuals.contains(key));
        exitDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !visibleExits.contains(key));
    }

    record StateProjection(
            String stateText,
            String statusText,
            boolean busy,
            List<RoomNarrationCardProjection> narrationCards
    ) {
        StateProjection {
            stateText = stateText == null ? "" : stateText;
            statusText = statusText == null ? "" : statusText;
            narrationCards = narrationCards == null ? List.of() : List.copyOf(narrationCards);
        }

        static StateProjection initial() {
            return new StateProjection("", "", false, List.of());
        }
    }

    record StateProjectionContext(
            long selectedMapIdValue,
            String statusText,
            boolean busy,
            String selectedToolLabel,
            String viewModeLabel,
            int projectionLevel,
            String overlayLabel
    ) {
        StateProjectionContext {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            statusText = statusText == null ? "" : statusText;
            selectedToolLabel = selectedToolLabel == null ? ToolCatalog.DEFAULT_TOOL_LABEL : selectedToolLabel;
            viewModeLabel = ToolCatalog.normalizeViewModeKey(viewModeLabel);
            projectionLevel = Math.max(0, projectionLevel);
            overlayLabel = overlayLabel == null ? "" : overlayLabel;
        }

        static StateProjectionContext empty() {
            return new StateProjectionContext(
                    0L,
                    "",
                    false,
                    ToolCatalog.DEFAULT_TOOL_LABEL,
                    ToolCatalog.GRID_VIEW_LABEL,
                    0,
                    "");
        }
    }

    record RoomNarrationCardProjection(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationProjection> exits
    ) {
        RoomNarrationCardProjection {
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName;
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record RoomExitNarrationProjection(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        RoomExitNarrationProjection {
            label = label == null || label.isBlank() ? "Ausgang" : label;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction;
            description = description == null ? "" : description;
        }

        RoomExitNarrationProjection withDescription(String nextDescription) {
            return new RoomExitNarrationProjection(label, q, r, level, direction, nextDescription);
        }
    }

    private record VisualDraftKey(long selectedMapIdValue, long roomId) {
        VisualDraftKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            roomId = Math.max(0L, roomId);
        }
    }

    private record ExitDraftKey(
            long selectedMapIdValue,
            long roomId,
            String label,
            int q,
            int r,
            int level,
            String direction
    ) {
        ExitDraftKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            roomId = Math.max(0L, roomId);
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
        }

        static ExitDraftKey from(
                long selectedMapIdValue,
                long roomId,
                RoomExitNarrationProjection exit
        ) {
            RoomExitNarrationProjection safeExit = exit == null
                    ? new RoomExitNarrationProjection("", 0, 0, 0, "", "")
                    : exit;
            return new ExitDraftKey(
                    selectedMapIdValue,
                    roomId,
                    safeExit.label(),
                    safeExit.q(),
                    safeExit.r(),
                    safeExit.level(),
                    safeExit.direction());
        }
    }

    private static final class ProjectionTextSupport {
        private ProjectionTextSupport() {
        }

        private static String stateTextFor(
                DungeonEditorStateSnapshot snapshot,
                StateProjectionContext context
        ) {
            return "Werkzeug: " + context.selectedToolLabel()
                    + "\nAnsicht: " + context.viewModeLabel()
                    + "\nEbene: z=" + context.projectionLevel()
                    + "\n" + context.overlayLabel()
                    + "\n" + selectionTextFor(SelectionData.from(snapshot.selection()), snapshot.inspector())
                    + "\n" + previewTextFor(snapshot.preview());
        }

        private static List<RoomNarrationCardProjection> toNarrationCards(
                @Nullable DungeonInspectorSnapshot inspector
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

    private record SelectionData(String kind, long id) {
        SelectionData {
            kind = kind == null ? "EMPTY" : kind;
            id = Math.max(0L, id);
        }

        private static SelectionData from(DungeonEditorStateSnapshot.Selection selection) {
            DungeonEditorStateSnapshot.Selection safeSelection = selection == null
                    ? DungeonEditorStateSnapshot.Selection.empty()
                    : selection;
            return new SelectionData(safeSelection.topologyRef().kind(), safeSelection.topologyRef().id());
        }

        private boolean isEmpty() {
            return "EMPTY".equals(kind);
        }
    }
}
