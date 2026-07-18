package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.editor.DungeonEditorDraftState;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolFamily;

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

    void apply(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonEditorDraftState draft = safeState.draft();
        List<RoomNarrationCardProjection> narrationCards = narrationContent.narrationCards(
                safeState.inspector(),
                draft.roomNarrations());
        stateProjection.set(new StateProjection(
                selectionPreviewContent.stateTextFor(safeState),
                safeState.commandStatus().message(),
                safeState.commandStatus().busy(),
                narrationContent.renderStructureKey(
                        narrationCards,
                        safeState.commandStatus().busy(),
                        safeState.commandStatus().message()),
                narrationCards,
                nameProjection(safeState),
                corridorPointProjection(safeState),
                featureMarkerProjection(safeState),
                transitionContent.transitionDestinationProjection(safeState),
                transitionContent.transitionDescriptionProjection(safeState),
                stairGeometryContent.stairGeometryProjection(safeState)));
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

    private static @Nullable NameProjection nameProjection(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonEditorDraftState.LabelNameDraft target = safeState.draft().labelName();
        if (!target.present() && target.targetId() <= 0L) {
            return null;
        }
        DungeonInspectorSnapshot inspector = safeState.inspector();
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

    private static @Nullable FeatureMarkerProjection featureMarkerProjection(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonTopologyElementRef topologyRef = safeState.selection().topologyRef();
        DungeonInspectorSnapshot inspector = safeState.inspector();
        if (topologyRef == null
                || topologyRef.kind() != features.dungeon.api.DungeonTopologyElementKind.FEATURE_MARKER
                || topologyRef.id() <= 0L
                || inspector == null) {
            return null;
        }
        return new FeatureMarkerProjection(
                topologyRef.id(),
                inspector.title(),
                inspector.summary());
    }

    private static LabelNameTarget labelNameTarget(DungeonEditorDraftState.LabelNameDraft target) {
        if (target == null || target.targetId() <= 0L) {
            return LabelNameTarget.empty();
        }
        return switch (target.targetKind()) {
            case "ROOM" -> LabelNameTarget.room(target.targetId());
            case "CLUSTER" -> LabelNameTarget.cluster(target.targetId());
            default -> LabelNameTarget.empty();
        };
    }

    private static @Nullable CorridorPointProjection corridorPointProjection(
            DungeonEditorState state
    ) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonEditorDraftState.CorridorPointDraft draft = safeState.draft().corridorPoint();
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
            @Nullable FeatureMarkerProjection featureMarker,
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
            return new StateProjection("", "", false, "", List.of(), null, null, null, null, null, null);
        }
    }

    record FeatureMarkerProjection(long markerId, String label, String description) {
        FeatureMarkerProjection {
            markerId = Math.max(0L, markerId);
            label = label == null ? "" : label;
            description = description == null ? "" : description;
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
            List<DungeonEditorDraftState.RoomNarrationDraft> narrationDrafts
    ) {
        List<DungeonEditorDraftState.RoomNarrationDraft> safeDrafts = narrationDrafts == null
                ? List.of()
                : List.copyOf(narrationDrafts);
        Map<Long, DungeonEditorDraftState.RoomNarrationDraft> roomDrafts = safeDrafts.stream()
                .collect(java.util.stream.Collectors.toMap(
                        DungeonEditorDraftState.RoomNarrationDraft::roomId,
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
            DungeonEditorDraftState.RoomNarrationDraft roomDraft
    ) {
        Map<RoomExitKey, DungeonEditorDraftState.ExitNarrationDraft> exitDrafts = roomDraft == null
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
            DungeonEditorDraftState.ExitNarrationDraft exitDraft
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

        static RoomExitKey from(DungeonEditorDraftState.ExitNarrationDraft exit) {
            DungeonEditorDraftState.ExitNarrationDraft safeExit = exit == null
                    ? new DungeonEditorDraftState.ExitNarrationDraft("", 0, 0, 0, "", "", false)
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

    String stateTextFor(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        return "Werkzeug: " + DungeonEditorControlsPanelModel.labelOf(safeState.toolSelection())
                + "\nAnsicht: " + normalizeViewModeKey(safeState.viewMode().name())
                + "\nEbene: z=" + safeState.projectionLevel()
                + "\nOverlay: " + safeState.overlaySettings().modeKey()
                + "\n" + selectionTextFor(
                        SelectionData.from(safeState.selection().topologyRef()), safeState.inspector())
                + "\n" + previewTextFor(safeState.preview());
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
                : selection.kind().name();
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

    private record SelectionData(features.dungeon.api.DungeonTopologyElementKind kind, long id) {
        SelectionData {
            kind = kind == null ? features.dungeon.api.DungeonTopologyElementKind.EMPTY : kind;
            id = Math.max(0L, id);
        }

        private static SelectionData from(DungeonTopologyElementRef topologyRef) {
            DungeonTopologyElementRef safeTopologyRef = topologyRef == null
                    ? DungeonTopologyElementRef.empty()
                    : topologyRef;
            return new SelectionData(safeTopologyRef.kind(), safeTopologyRef.id());
        }

        private boolean isEmpty() {
            return kind == features.dungeon.api.DungeonTopologyElementKind.EMPTY;
        }
    }
    }

    private static final class StairGeometryPanel {
    DungeonEditorStatePanelModel.@Nullable StairGeometryProjection stairGeometryProjection(
            DungeonEditorState state
    ) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonTopologyElementRef topologyRef = safeState.selection().topologyRef() == null
                ? DungeonTopologyElementRef.empty()
                : safeState.selection().topologyRef();
        DungeonInspectorSnapshot inspector = safeState.inspector();
        long stairId = selectedStairId(topologyRef);
        if (stairId <= 0L || inspector == null) {
            return null;
        }
        StairGeometryFacts facts = StairGeometryFacts.from(inspector.statePanelFacts().stairGeometry());
        if (facts == null) {
            return null;
        }
        StairGeometryFacts draft = currentStairGeometryFacts(safeState.draft().stairGeometry(), stairId, facts);
        String label = inspector.title().isBlank() ? "Treppe " + stairId : inspector.title();
        return new DungeonEditorStatePanelModel.StairGeometryProjection(
                stairId,
                label,
                draft.shapeName(),
                draft.directionName(),
                draft.dimension1(),
                draft.dimension2());
    }

    private static long selectedStairId(DungeonTopologyElementRef topologyRef) {
        DungeonTopologyElementRef safeTopologyRef = topologyRef == null
                ? DungeonTopologyElementRef.empty()
                : topologyRef;
        return safeTopologyRef.kind() == features.dungeon.api.DungeonTopologyElementKind.STAIR
                ? safeTopologyRef.id()
                : 0L;
    }

    private static StairGeometryFacts currentStairGeometryFacts(
            DungeonEditorDraftState.StairGeometryDraft runtimeDraft,
            long stairId,
            StairGeometryFacts fallback
    ) {
        DungeonEditorDraftState.StairGeometryDraft safeDraft = runtimeDraft == null
                ? DungeonEditorDraftState.StairGeometryDraft.empty()
                : runtimeDraft;
        if (!runtimeStairDraftMatches(safeDraft, stairId)) {
            return fallback;
        }
        return new StairGeometryFacts(
                safeDraft.shape(),
                safeDraft.direction(),
                safeDraft.dimension1(),
                safeDraft.dimension2());
    }

    private static boolean runtimeStairDraftMatches(
            DungeonEditorDraftState.StairGeometryDraft runtimeDraft,
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
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";
    private static final String DESTINATION_UNLINKED_ENTRANCE = "UNLINKED_ENTRANCE";
    private static final List<DestinationTypeOption> DESTINATION_TYPE_OPTIONS = List.of(
            new DestinationTypeOption(DESTINATION_UNLINKED_ENTRANCE, "Kein Ziel"),
            new DestinationTypeOption(DESTINATION_OVERWORLD_TILE, "Weltkarte"),
            new DestinationTypeOption(DESTINATION_DUNGEON_MAP, "Dungeon-Eingang"));

    DungeonEditorStatePanelModel.@Nullable TransitionDescriptionProjection transitionDescriptionProjection(
            DungeonEditorState state
    ) {
        DungeonEditorState safeState = safeState(state);
        DungeonTopologyElementRef topologyRef = safeTopologyRef(safeState.selection().topologyRef());
        DungeonInspectorSnapshot inspector = safeState.inspector();
        DungeonEditorDraftState.TransitionDescriptionDraft runtimeDraft =
                safeTransitionDescriptionDraft(safeState.draft().transitionDescription());
        if (runtimeDraft.transitionId() <= NO_TRANSITION_ID
                || topologyRef.kind() != features.dungeon.api.DungeonTopologyElementKind.TRANSITION
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
            DungeonEditorState state
    ) {
        DungeonEditorState safeState = safeState(state);
        if (safeState.selectedMapId() == null || safeState.selectedMapId().value() <= NO_SELECTED_MAP_ID) {
            return null;
        }
        DungeonTopologyElementRef topologyRef = safeTopologyRef(safeState.selection().topologyRef());
        long selectedTransitionId = selectedTransitionId(topologyRef);
        if (safeState.toolSelection().family() != DungeonEditorToolFamily.TRANSITION
                && selectedTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        DungeonEditorDraftState.TransitionDestinationDraft runtimeDraft =
                safeTransitionDestinationDraft(safeState.draft().transitionDestination());
        if (!runtimeDraft.targetPresent()) {
            return null;
        }
        TransitionDestinationDraft baseline = TransitionDestinationDraft.fromTypedInspector(safeState.inspector());
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
                safeState.commandStatus().busy());
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

    private static DungeonEditorState safeState(DungeonEditorState state) {
        return state == null ? DungeonEditorState.empty() : state;
    }

    private static DungeonTopologyElementRef safeTopologyRef(DungeonTopologyElementRef topologyRef) {
        return topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }

    private static DungeonEditorDraftState.TransitionDescriptionDraft safeTransitionDescriptionDraft(
            DungeonEditorDraftState.TransitionDescriptionDraft draft
    ) {
        return draft == null ? DungeonEditorDraftState.TransitionDescriptionDraft.empty() : draft;
    }

    private static DungeonEditorDraftState.TransitionDestinationDraft safeTransitionDestinationDraft(
            DungeonEditorDraftState.TransitionDestinationDraft draft
    ) {
        return draft == null ? DungeonEditorDraftState.TransitionDestinationDraft.empty() : draft;
    }

    private static long selectedTransitionId(DungeonTopologyElementRef topologyRef) {
        DungeonTopologyElementRef safeTopologyRef = safeTopologyRef(topologyRef);
        return safeTopologyRef.kind() == features.dungeon.api.DungeonTopologyElementKind.TRANSITION
                ? safeTopologyRef.id()
                : 0L;
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
                DungeonEditorDraftState.TransitionDestinationDraft draft
        ) {
            DungeonEditorDraftState.TransitionDestinationDraft safeDraft =
                    draft == null ? DungeonEditorDraftState.TransitionDestinationDraft.empty() : draft;
            return new TransitionDestinationDraft(
                    safeDraft.destinationType(),
                    safeDraft.mapId(),
                    safeDraft.tileId(),
                    safeDraft.transitionId(),
                    safeDraft.bidirectional());
        }
    }
    }

}
