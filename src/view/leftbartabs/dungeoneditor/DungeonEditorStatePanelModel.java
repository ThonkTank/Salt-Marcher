package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorStatePanelCorridorPointDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelLabelNameDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelRoomNarrationDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelStairGeometryDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDescriptionDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDestinationDrafts;

final class DungeonEditorStatePanelModel {
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final NarrationPanel narrationContent =
            new NarrationPanel();
    private final TransitionPanel transitionContent =
            new TransitionPanel();
    private final StairGeometryPanel stairGeometryContent =
            new StairGeometryPanel();
    private final SelectionPreviewPanel selectionPreviewContent =
            new SelectionPreviewPanel();

    ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    void apply(DungeonEditorPreparedFrameFacts.StatePanelFrame frame) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        List<RoomNarrationCardProjection> narrationCards = narrationContent.narrationCards(
                safeFrame.inspector(),
                safeFrame.roomNarrationDrafts());
        stateProjection.set(new StateProjection(
                selectionPreviewContent.stateTextFor(safeFrame),
                safeFrame.statusText(),
                safeFrame.busy(),
                narrationContent.renderStructureKey(
                        narrationCards,
                        safeFrame.busy(),
                        safeFrame.statusText()),
                narrationCards,
                nameProjection(safeFrame),
                corridorPointProjection(safeFrame),
                transitionContent.transitionDestinationProjection(safeFrame),
                transitionContent.transitionDescriptionProjection(safeFrame),
                stairGeometryContent.stairGeometryProjection(safeFrame)));
    }

    @Nullable RoomNarrationCardProjection currentNarrationCard(long roomId) {
        return narrationContent.currentNarrationCard(stateProjection.get(), roomId);
    }

    LabelNameTarget currentLabelNameTarget() {
        StateProjection currentProjection = stateProjection.get();
        StateProjection safeProjection = currentProjection == null
                ? StateProjection.initial()
                : currentProjection;
        return safeProjection.name() == null ? LabelNameTarget.empty() : safeProjection.name().target();
    }

    static String transitionDestinationTypeKey(int optionIndex) {
        return TransitionPanel.transitionDestinationTypeKey(optionIndex);
    }

    private static @Nullable NameProjection nameProjection(DungeonEditorPreparedFrameFacts.StatePanelFrame frame) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        DungeonEditorStatePanelLabelNameDrafts.Draft target = safeFrame.labelNameDraft();
        if (!target.targetPresent()) {
            return null;
        }
        DungeonInspectorSnapshot inspector = safeFrame.inspector();
        String fallbackName = target.fallbackName();
        String currentName = inspector == null || inspector.title().isBlank() ? fallbackName : inspector.title();
        String draft = target.present()
                ? target.name()
                : currentName;
        return new NameProjection(
                labelNameTarget(target),
                target.label(),
                draft);
    }

    private static LabelNameTarget labelNameTarget(
            DungeonEditorStatePanelLabelNameDrafts.Draft target
    ) {
        if (target == null || !target.targetPresent()) {
            return LabelNameTarget.empty();
        }
        return switch (target.target().kind()) {
            case ROOM -> LabelNameTarget.room(target.target().id());
            case CLUSTER -> LabelNameTarget.cluster(target.target().id());
            case EMPTY -> LabelNameTarget.empty();
        };
    }

    private static @Nullable CorridorPointProjection corridorPointProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        DungeonEditorStatePanelCorridorPointDrafts.Draft draft = safeFrame.corridorPointDraft();
        if (!draft.targetPresent()) {
            return null;
        }
        return new CorridorPointProjection(
                draft.label(),
                draft.q(),
                draft.r(),
                draft.level());
    }

    record StateProjection(
            String stateText,
            String statusText,
            boolean busy,
            String narrationRenderStructureKey,
            List<RoomNarrationCardProjection> narrationCards,
            @Nullable NameProjection name,
            @Nullable CorridorPointProjection corridorPoint,
            @Nullable TransitionDestinationProjection transitionDestination,
            @Nullable TransitionDescriptionProjection transitionDescription,
            @Nullable StairGeometryProjection stairGeometry
    ) {
        StateProjection {
            stateText = stateText == null ? "" : stateText;
            statusText = statusText == null ? "" : statusText;
            narrationRenderStructureKey = narrationRenderStructureKey == null ? "" : narrationRenderStructureKey;
            narrationCards = narrationCards == null ? List.of() : List.copyOf(narrationCards);
        }

        static StateProjection initial() {
            return new StateProjection("", "", false, "", List.of(), null, null, null, null, null);
        }
    }

    record NameProjection(LabelNameTarget target, String label, String name) {
        NameProjection {
            target = target == null ? LabelNameTarget.empty() : target;
            label = label == null || label.isBlank() ? "Name" : label;
            name = name == null ? "" : name;
        }
    }

    record LabelNameTarget(Kind kind, long id) {
        private static final LabelNameTarget EMPTY = new LabelNameTarget(Kind.EMPTY, 0L);

        LabelNameTarget {
            kind = kind == null ? Kind.EMPTY : kind;
            id = Math.max(0L, id);
            if (kind == Kind.EMPTY || id == 0L) {
                kind = Kind.EMPTY;
                id = 0L;
            }
        }

        static LabelNameTarget empty() {
            return EMPTY;
        }

        static LabelNameTarget room(long roomId) {
            return new LabelNameTarget(Kind.ROOM, roomId);
        }

        static LabelNameTarget cluster(long clusterId) {
            return new LabelNameTarget(Kind.CLUSTER, clusterId);
        }

        enum Kind {
            EMPTY,
            ROOM,
            CLUSTER
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

    record CorridorPointProjection(
            String label,
            String q,
            String r,
            String level
    ) {
        CorridorPointProjection {
            label = label == null || label.isBlank() ? "Korridorpunkt" : label;
            q = q == null ? "" : q;
            r = r == null ? "" : r;
            level = level == null ? "" : level;
        }
    }

    record TransitionDescriptionProjection(
            long transitionId,
            String label,
            String description
    ) {
        TransitionDescriptionProjection {
            transitionId = Math.max(0L, transitionId);
            label = label == null || label.isBlank() ? "Übergang" : label;
            description = description == null ? "" : description;
        }
    }

    record TransitionDestinationProjection(
            String label,
            long sourceTransitionId,
            String destinationTypeKey,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional,
            boolean busy
    ) {
        TransitionDestinationProjection {
            label = label == null || label.isBlank() ? "Übergang-Ziel" : label;
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            destinationTypeKey = TransitionPanel.normalizeDestinationTypeKey(
                    destinationTypeKey);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
        }

        TransitionDestinationControlState controlState() {
            return controlStateFor(destinationTypeKey, mapId, transitionId);
        }

        List<String> destinationTypeLabels() {
            return TransitionPanel.destinationTypeLabels();
        }

        String selectedDestinationTypeLabel() {
            return TransitionPanel.destinationTypeLabel(destinationTypeKey);
        }

        String linkTargetHintText() {
            return TransitionPanel.linkTargetHintText();
        }

        TransitionDestinationControlState controlStateForOptionIndex(
                int selectedDestinationTypeOptionIndex,
                String candidateMapId,
                String candidateTransitionId
        ) {
            return controlStateFor(
                    TransitionPanel.transitionDestinationTypeKey(
                            selectedDestinationTypeOptionIndex),
                    candidateMapId,
                    candidateTransitionId);
        }

        TransitionDestinationControlState controlStateFor(
                String selectedDestinationTypeKey,
                String candidateMapId,
                String candidateTransitionId
        ) {
            return TransitionPanel.controlStateFor(
                    this,
                    selectedDestinationTypeKey,
                    candidateMapId,
                    candidateTransitionId);
        }
    }

    record TransitionDestinationControlState(
            boolean linkMode,
            boolean destinationTypeDisabled,
            boolean mapIdDisabled,
            boolean tileIdDisabled,
            boolean transitionIdDisabled,
            boolean bidirectionalDisabled,
            boolean mapIdLabelDisabled,
            boolean tileIdLabelDisabled,
            boolean transitionIdLabelDisabled,
            boolean saveDisabled
    ) {
    }

    record StairGeometryProjection(
            long stairId,
            String label,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        StairGeometryProjection {
            stairId = Math.max(0L, stairId);
            label = label == null || label.isBlank() ? "Treppe" : label;
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName;
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName;
            dimension1 = dimension1 == null ? "" : dimension1;
            dimension2 = dimension2 == null ? "" : dimension2;
        }
    }
    private static final class NarrationPanel {

    List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> narrationCards(
            @Nullable DungeonInspectorSnapshot inspector,
            DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts narrationDrafts
    ) {
        DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts safeDrafts = narrationDrafts == null
                ? DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty()
                : narrationDrafts;
        Map<Long, DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft> roomDrafts = safeDrafts.rooms().stream()
                .collect(java.util.stream.Collectors.toMap(
                        DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft::roomId,
                        draft -> draft,
                        (first, second) -> second));
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> narrationCard(card, roomDrafts.get(card.roomId())))
                .toList();
    }

    DungeonEditorStatePanelModel.@Nullable RoomNarrationCardProjection currentNarrationCard(
            DungeonEditorStatePanelModel.StateProjection projection,
            long roomId
    ) {
        DungeonEditorStatePanelModel.StateProjection safeProjection = projection == null
                ? DungeonEditorStatePanelModel.StateProjection.initial()
                : projection;
        for (DungeonEditorStatePanelModel.RoomNarrationCardProjection card : safeProjection.narrationCards()) {
            if (card.roomId() == roomId) {
                return card;
            }
        }
        return null;
    }

    String renderStructureKey(
            List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText
    ) {
        StringBuilder key = new StringBuilder();
        key.append(busy).append('|').append(statusText == null ? "" : statusText);
        for (DungeonEditorStatePanelModel.RoomNarrationCardProjection card
                : cards == null ? List.<DungeonEditorStatePanelModel.RoomNarrationCardProjection>of() : cards) {
            key.append("|room=").append(card.roomId()).append(':').append(card.roomName());
            for (DungeonEditorStatePanelModel.RoomExitNarrationProjection exit : card.exits()) {
                key.append("|exit=")
                        .append(exit.label())
                        .append('@')
                        .append(exit.q())
                        .append(',')
                        .append(exit.r())
                        .append(',')
                        .append(exit.level())
                        .append(':')
                        .append(exit.direction());
            }
        }
        return key.toString();
    }

    private static DungeonEditorStatePanelModel.RoomNarrationCardProjection narrationCard(
            DungeonInspectorSnapshot.RoomNarrationCard card,
            DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft roomDraft
    ) {
        Map<RoomExitKey, DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft> exitDrafts = roomDraft == null
                ? Map.of()
                : roomDraft.exits().stream()
                .collect(java.util.stream.Collectors.toMap(
                        RoomExitKey::from,
                        draft -> draft,
                        (first, second) -> second));
        return new DungeonEditorStatePanelModel.RoomNarrationCardProjection(
                card.roomId(),
                card.roomName(),
                roomDraft != null && roomDraft.visualPresent()
                        ? roomDraft.visualDescription()
                        : card.visualDescription(),
                card.exits().stream()
                        .map(exit -> narrationExit(exit, exitDrafts.get(RoomExitKey.from(exit))))
                        .toList());
    }

    private static DungeonEditorStatePanelModel.RoomExitNarrationProjection narrationExit(
            DungeonInspectorSnapshot.RoomExitNarration exit,
            DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft exitDraft
    ) {
        return new DungeonEditorStatePanelModel.RoomExitNarrationProjection(
                exit.label(),
                exit.cell().q(),
                exit.cell().r(),
                exit.cell().level(),
                exit.direction(),
                exitDraft != null && exitDraft.present()
                        ? exitDraft.description()
                        : exit.description());
    }

    private record RoomExitKey(
            String label,
            int q,
            int r,
            int level,
            String direction
    ) {
        RoomExitKey {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
        }

        static RoomExitKey from(DungeonInspectorSnapshot.RoomExitNarration exit) {
            if (exit == null || exit.cell() == null) {
                return new RoomExitKey("", 0, 0, 0, "");
            }
            return new RoomExitKey(
                    exit.label(),
                    exit.cell().q(),
                    exit.cell().r(),
                    exit.cell().level(),
                    exit.direction());
        }

        static RoomExitKey from(DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft exit) {
            DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft safeExit = exit == null
                    ? new DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft("", 0, 0, 0, "", "", false)
                    : exit;
            return new RoomExitKey(
                    safeExit.label(),
                    safeExit.q(),
                    safeExit.r(),
                    safeExit.level(),
                    safeExit.direction());
        }
    }
    }

    private static final class SelectionPreviewPanel {

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

    private static final class StairGeometryPanel {
    private static final String STAIR_KIND = "STAIR";

    DungeonEditorStatePanelModel.@Nullable StairGeometryProjection stairGeometryProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        DungeonEditorTopologyElementRef topologyRef = safeFrame.selectionTopologyRef() == null
                ? DungeonEditorTopologyElementRef.empty()
                : safeFrame.selectionTopologyRef();
        DungeonInspectorSnapshot inspector = safeFrame.inspector();
        long stairId = selectedStairId(topologyRef);
        if (stairId <= 0L || inspector == null) {
            return null;
        }
        StairGeometryFacts facts = StairGeometryFacts.from(inspector.statePanelFacts().stairGeometry());
        if (facts == null) {
            return null;
        }
        StairGeometryFacts draft = currentStairGeometryFacts(safeFrame.stairGeometryDraft(), stairId, facts);
        String label = inspector.title().isBlank() ? "Treppe " + stairId : inspector.title();
        return new DungeonEditorStatePanelModel.StairGeometryProjection(
                stairId,
                label,
                draft.shapeName(),
                draft.directionName(),
                draft.dimension1(),
                draft.dimension2());
    }

    private static long selectedStairId(DungeonEditorTopologyElementRef topologyRef) {
        DungeonEditorTopologyElementRef safeTopologyRef = topologyRef == null
                ? DungeonEditorTopologyElementRef.empty()
                : topologyRef;
        return STAIR_KIND.equals(safeTopologyRef.kind()) ? safeTopologyRef.id() : 0L;
    }

    private static StairGeometryFacts currentStairGeometryFacts(
            DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft,
            long stairId,
            StairGeometryFacts fallback
    ) {
        DungeonEditorStatePanelStairGeometryDrafts.Draft safeDraft = runtimeDraft == null
                ? DungeonEditorStatePanelStairGeometryDrafts.Draft.empty()
                : runtimeDraft;
        if (!runtimeStairDraftMatches(safeDraft, stairId)) {
            return fallback;
        }
        return new StairGeometryFacts(
                safeDraft.shapeName(),
                safeDraft.directionName(),
                safeDraft.dimension1(),
                safeDraft.dimension2());
    }

    private static boolean runtimeStairDraftMatches(
            DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft,
            long stairId
    ) {
        return runtimeDraft.present() && runtimeDraft.targetPresent() && runtimeDraft.stairId() == stairId;
    }

    private record StairGeometryFacts(
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        StairGeometryFacts {
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = dimension1 == null ? "" : dimension1.strip();
            dimension2 = dimension2 == null ? "" : dimension2.strip();
        }

        private static @Nullable StairGeometryFacts from(DungeonInspectorSnapshot.StairGeometryFacts facts) {
            DungeonInspectorSnapshot.StairGeometryFacts safeFacts = facts == null
                    ? DungeonInspectorSnapshot.StairGeometryFacts.empty()
                    : facts;
            if (!safeFacts.present()) {
                return null;
            }
            return new StairGeometryFacts(
                    safeFacts.shapeName(),
                    safeFacts.directionName(),
                    String.valueOf(safeFacts.dimension1()),
                    String.valueOf(safeFacts.dimension2()));
        }
    }
    }

    private static final class TransitionPanel {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_SELECTED_MAP_ID = 0L;
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";
    private static final String DESTINATION_UNLINKED_ENTRANCE = "UNLINKED_ENTRANCE";
    private static final List<DestinationTypeOption> DESTINATION_TYPE_OPTIONS = List.of(
            new DestinationTypeOption(DESTINATION_UNLINKED_ENTRANCE, "Kein Ziel"),
            new DestinationTypeOption(DESTINATION_OVERWORLD_TILE, "Weltkarte"),
            new DestinationTypeOption(DESTINATION_DUNGEON_MAP, "Dungeon-Eingang"));

    DungeonEditorStatePanelModel.@Nullable TransitionDescriptionProjection transitionDescriptionProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = safeFrame(frame);
        DungeonEditorTopologyElementRef topologyRef = safeTopologyRef(safeFrame.selectionTopologyRef());
        DungeonInspectorSnapshot inspector = safeFrame.inspector();
        DungeonEditorStatePanelTransitionDescriptionDrafts.Draft runtimeDraft =
                safeTransitionDescriptionDraft(safeFrame.transitionDescriptionDraft());
        if (!runtimeDraft.targetPresent() || !"TRANSITION".equals(topologyRef.kind())
                || topologyRef.id() != runtimeDraft.transitionId()) {
            return null;
        }
        String title = inspector == null || inspector.title().isBlank()
                ? "Übergang " + topologyRef.id()
                : inspector.title();
        String description = inspector == null ? "" : inspector.summary();
        String draft = runtimeDraft.present()
                ? runtimeDraft.description()
                : description;
        return new DungeonEditorStatePanelModel.TransitionDescriptionProjection(
                topologyRef.id(),
                title,
                draft);
    }

    DungeonEditorStatePanelModel.@Nullable TransitionDestinationProjection transitionDestinationProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = safeFrame(frame);
        if (safeFrame.selectedMapIdValue() <= NO_SELECTED_MAP_ID) {
            return null;
        }
        DungeonEditorTopologyElementRef topologyRef = safeTopologyRef(safeFrame.selectionTopologyRef());
        long selectedTransitionId = selectedTransitionId(topologyRef);
        if (!TRANSITION_CREATE_TOOL.equals(safeFrame.selectedToolKey()) && selectedTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        DungeonEditorStatePanelTransitionDestinationDrafts.Draft runtimeDraft =
                safeTransitionDestinationDraft(safeFrame.transitionDestinationDraft());
        if (!runtimeDraft.targetPresent()) {
            return null;
        }
        TransitionDestinationDraft baseline = TransitionDestinationDraft.fromTypedInspector(safeFrame.inspector());
        TransitionDestinationDraft draft = runtimeDraft.present()
                ? TransitionDestinationDraft.fromRuntimeDraft(runtimeDraft)
                : baseline;
        return new DungeonEditorStatePanelModel.TransitionDestinationProjection(
                runtimeDraft.sourceTransitionId() > NO_TRANSITION_ID
                        ? "Übergang-Ziel / Eingangslink"
                        : "Übergang-Ziel",
                runtimeDraft.sourceTransitionId(),
                draft.destinationTypeKey(),
                draft.mapId(),
                draft.tileId(),
                draft.transitionId(),
                draft.bidirectional(),
                safeFrame.busy());
    }

    static String transitionDestinationTypeKey(int optionIndex) {
        return optionIndex >= 0 && optionIndex < DESTINATION_TYPE_OPTIONS.size()
                ? DESTINATION_TYPE_OPTIONS.get(optionIndex).key()
                : DESTINATION_UNLINKED_ENTRANCE;
    }

    static String normalizeDestinationTypeKey(String value) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        return destinationTypeOptionIndex(normalized) >= 0 ? normalized : DESTINATION_UNLINKED_ENTRANCE;
    }

    static List<String> destinationTypeLabels() {
        return DESTINATION_TYPE_OPTIONS.stream()
                .map(DestinationTypeOption::label)
                .toList();
    }

    static String destinationTypeLabel(String key) {
        int index = destinationTypeOptionIndex(key);
        return index >= 0 ? DESTINATION_TYPE_OPTIONS.get(index).label() : DESTINATION_TYPE_OPTIONS.getFirst().label();
    }

    static String linkTargetHintText() {
        return "Eingangslink: Dungeon-Eingang als Ziel wählen";
    }

    static DungeonEditorStatePanelModel.TransitionDestinationControlState controlStateFor(
            DungeonEditorStatePanelModel.TransitionDestinationProjection projection,
            String selectedDestinationTypeKey,
            String candidateMapId,
            String candidateTransitionId
    ) {
        DungeonEditorStatePanelModel.TransitionDestinationProjection safeProjection = projection == null
                ? new DungeonEditorStatePanelModel.TransitionDestinationProjection(
                        "",
                        0L,
                        DESTINATION_UNLINKED_ENTRANCE,
                        "",
                        "",
                        "",
                        true,
                        false)
                : projection;
        String safeDestinationType = normalizeDestinationTypeKey(selectedDestinationTypeKey);
        boolean linkMode = safeProjection.sourceTransitionId() > NO_TRANSITION_ID;
        boolean dungeonMapDestination = DESTINATION_DUNGEON_MAP.equals(safeDestinationType);
        boolean unlinkedEntrance = DESTINATION_UNLINKED_ENTRANCE.equals(safeDestinationType);
        boolean readOnlySelectedOverworld = linkMode
                && !dungeonMapDestination
                && !unlinkedEntrance;
        boolean targetFieldsComplete = completeIntegerText(candidateMapId)
                && completeIntegerText(candidateTransitionId);
        return new DungeonEditorStatePanelModel.TransitionDestinationControlState(
                linkMode,
                safeProjection.busy(),
                mapIdDisabled(safeProjection.busy(), readOnlySelectedOverworld, unlinkedEntrance),
                tileIdDisabled(safeProjection.busy(), dungeonMapDestination, readOnlySelectedOverworld,
                        unlinkedEntrance),
                transitionIdDisabled(safeProjection.busy(), dungeonMapDestination, unlinkedEntrance),
                bidirectionalDisabled(safeProjection.busy(), linkMode, dungeonMapDestination),
                readOnlySelectedOverworld || unlinkedEntrance,
                tileIdLabelDisabled(dungeonMapDestination, readOnlySelectedOverworld, unlinkedEntrance),
                !dungeonMapDestination || unlinkedEntrance,
                saveDisabled(safeProjection.busy(), linkMode, dungeonMapDestination, targetFieldsComplete));
    }

    private static DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        return frame == null ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty() : frame;
    }

    private static DungeonEditorTopologyElementRef safeTopologyRef(DungeonEditorTopologyElementRef topologyRef) {
        return topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
    }

    private static DungeonEditorStatePanelTransitionDescriptionDrafts.Draft safeTransitionDescriptionDraft(
            DungeonEditorStatePanelTransitionDescriptionDrafts.Draft draft
    ) {
        return draft == null ? DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty() : draft;
    }

    private static DungeonEditorStatePanelTransitionDestinationDrafts.Draft safeTransitionDestinationDraft(
            DungeonEditorStatePanelTransitionDestinationDrafts.Draft draft
    ) {
        return draft == null ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty() : draft;
    }

    private static long selectedTransitionId(DungeonEditorTopologyElementRef topologyRef) {
        DungeonEditorTopologyElementRef safeTopologyRef = safeTopologyRef(topologyRef);
        return "TRANSITION".equals(safeTopologyRef.kind()) ? safeTopologyRef.id() : 0L;
    }

    private static int destinationTypeOptionIndex(String key) {
        String safeKey = key == null ? "" : key.strip().toUpperCase(Locale.ROOT);
        for (int index = 0; index < DESTINATION_TYPE_OPTIONS.size(); index++) {
            if (DESTINATION_TYPE_OPTIONS.get(index).key().equals(safeKey)) {
                return index;
            }
        }
        return -1;
    }

    private static boolean completeIntegerText(String text) {
        return text != null && !text.isBlank() && !"-".equals(text);
    }

    private static boolean mapIdDisabled(
            boolean busy,
            boolean readOnlySelectedOverworld,
            boolean unlinkedEntrance
    ) {
        return busy || readOnlySelectedOverworld || unlinkedEntrance;
    }

    private static boolean tileIdDisabled(
            boolean busy,
            boolean dungeonMapDestination,
            boolean readOnlySelectedOverworld,
            boolean unlinkedEntrance
    ) {
        return busy || dungeonMapDestination || readOnlySelectedOverworld || unlinkedEntrance;
    }

    private static boolean transitionIdDisabled(
            boolean busy,
            boolean dungeonMapDestination,
            boolean unlinkedEntrance
    ) {
        return busy || !dungeonMapDestination || unlinkedEntrance;
    }

    private static boolean bidirectionalDisabled(
            boolean busy,
            boolean linkMode,
            boolean dungeonMapDestination
    ) {
        return busy || !linkMode || !dungeonMapDestination;
    }

    private static boolean tileIdLabelDisabled(
            boolean dungeonMapDestination,
            boolean readOnlySelectedOverworld,
            boolean unlinkedEntrance
    ) {
        return dungeonMapDestination || readOnlySelectedOverworld || unlinkedEntrance;
    }

    private static boolean saveDisabled(
            boolean busy,
            boolean linkMode,
            boolean dungeonMapDestination,
            boolean targetFieldsComplete
    ) {
        return busy || !linkMode || !dungeonMapDestination || !targetFieldsComplete;
    }

    private record DestinationTypeOption(String key, String label) {
        DestinationTypeOption {
            key = key == null ? "" : key.strip().toUpperCase(Locale.ROOT);
            label = label == null || label.isBlank() ? key : label;
        }
    }

    private record TransitionDestinationDraft(
            String destinationTypeKey,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        TransitionDestinationDraft {
            destinationTypeKey = normalizeDestinationTypeKey(destinationTypeKey);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
        }

        static TransitionDestinationDraft defaultDraft() {
            return new TransitionDestinationDraft(DESTINATION_UNLINKED_ENTRANCE, "", "", "", true);
        }

        static TransitionDestinationDraft fromTypedInspector(@Nullable DungeonInspectorSnapshot inspector) {
            if (inspector == null) {
                return defaultDraft();
            }
            DungeonInspectorSnapshot.TransitionDestinationFacts facts =
                    inspector.statePanelFacts().transitionDestination();
            if (!facts.present()) {
                return defaultDraft();
            }
            return new TransitionDestinationDraft(
                    normalizeDestinationTypeKey(facts.destinationTypeKey()),
                    facts.mapId() > 0L ? String.valueOf(facts.mapId()) : "",
                    facts.tileId() > 0L ? String.valueOf(facts.tileId()) : "",
                    facts.transitionId() > 0L ? String.valueOf(facts.transitionId()) : "",
                    true);
        }

        static TransitionDestinationDraft fromRuntimeDraft(
                DungeonEditorStatePanelTransitionDestinationDrafts.Draft draft
        ) {
            DungeonEditorStatePanelTransitionDestinationDrafts.Draft safeDraft =
                    draft == null ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty() : draft;
            return new TransitionDestinationDraft(
                    safeDraft.destinationTypeKey(),
                    safeDraft.mapId(),
                    safeDraft.tileId(),
                    safeDraft.transitionId(),
                    safeDraft.bidirectional());
        }
    }
    }

}
