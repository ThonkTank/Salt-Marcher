package src.view.leftbartabs.dungeoneditor;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorStatePanelCorridorPointDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelLabelNameDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelRoomNarrationDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelStairGeometryDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDescriptionDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDestinationDrafts;

final class DungeonEditorStateContentModel {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_SELECTED_MAP_ID = 0L;
    private static final String STAIR_KIND = "STAIR";
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";
    private static final String DEFAULT_TOOL_LABEL = "Auswahl";
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";
    private static final String DESTINATION_UNLINKED_ENTRANCE = "UNLINKED_ENTRANCE";
    private static final List<DestinationTypeOption> DESTINATION_TYPE_OPTIONS = List.of(
            new DestinationTypeOption(DESTINATION_UNLINKED_ENTRANCE, "Kein Ziel"),
            new DestinationTypeOption(DESTINATION_OVERWORLD_TILE, "Weltkarte"),
            new DestinationTypeOption(DESTINATION_DUNGEON_MAP, "Dungeon-Eingang"));

    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private DungeonEditorPreparedFrameFacts.StatePanelFrame currentFrame =
            DungeonEditorPreparedFrameFacts.StatePanelFrame.empty();

    ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    void apply(DungeonEditorPreparedFrameFacts.StatePanelFrame frame) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        currentFrame = safeFrame;
        List<RoomNarrationCardProjection> narrationCards = narrationCards(
                safeFrame.inspector(),
                safeFrame.roomNarrationDrafts());
        String narrationRenderStructureKey = narrationRenderStructureKey(
                narrationCards,
                safeFrame.busy(),
                safeFrame.statusText());
        TransitionDescriptionProjection transitionDescription = transitionDescriptionProjection(
                safeFrame.selectionTopologyRef(),
                safeFrame.inspector());
        TransitionDestinationProjection transitionDestination = transitionDestinationProjection(
                safeFrame,
                safeFrame.selectionTopologyRef(),
                safeFrame.inspector());
        StairGeometryProjection stairGeometry = stairGeometryProjection(
                safeFrame.selectionTopologyRef(),
                safeFrame.inspector());
        stateProjection.set(new StateProjection(
                ProjectionTextSupport.stateTextFor(safeFrame),
                safeFrame.statusText(),
                safeFrame.busy(),
                narrationRenderStructureKey,
                narrationCards,
                nameProjection(safeFrame.inspector()),
                corridorPointProjection(),
                transitionDestination,
                transitionDescription,
                stairGeometry));
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

    LabelNameTarget currentLabelNameTarget() {
        StateProjection currentProjection = stateProjection.get();
        StateProjection safeProjection = currentProjection == null
                ? StateProjection.initial()
                : currentProjection;
        return safeProjection.name() == null ? LabelNameTarget.empty() : safeProjection.name().target();
    }

    static String transitionDestinationTypeKey(int optionIndex) {
        return optionIndex >= 0 && optionIndex < DESTINATION_TYPE_OPTIONS.size()
                ? DESTINATION_TYPE_OPTIONS.get(optionIndex).key()
                : DESTINATION_UNLINKED_ENTRANCE;
    }

    private static List<RoomNarrationCardProjection> narrationCards(
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

    private static RoomNarrationCardProjection narrationCard(
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
        return new RoomNarrationCardProjection(
                card.roomId(),
                card.roomName(),
                roomDraft != null && roomDraft.visualPresent()
                        ? roomDraft.visualDescription()
                        : card.visualDescription(),
                card.exits().stream()
                        .map(exit -> narrationExit(exit, exitDrafts.get(RoomExitKey.from(exit))))
                        .toList());
    }

    private static RoomExitNarrationProjection narrationExit(
            DungeonInspectorSnapshot.RoomExitNarration exit,
            DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft exitDraft
    ) {
        return new RoomExitNarrationProjection(
                exit.label(),
                exit.cell().q(),
                exit.cell().r(),
                exit.cell().level(),
                exit.direction(),
                exitDraft != null && exitDraft.present()
                        ? exitDraft.description()
                        : exit.description());
    }

    private static String narrationRenderStructureKey(
            List<RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText
    ) {
        StringBuilder key = new StringBuilder();
        key.append(busy).append('|').append(statusText == null ? "" : statusText);
        for (RoomNarrationCardProjection card : cards == null ? List.<RoomNarrationCardProjection>of() : cards) {
            key.append("|room=").append(card.roomId()).append(':').append(card.roomName());
            for (RoomExitNarrationProjection exit : card.exits()) {
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

    private @Nullable NameProjection nameProjection(@Nullable DungeonInspectorSnapshot inspector) {
        DungeonEditorStatePanelLabelNameDrafts.Draft target = currentFrame.labelNameDraft();
        if (!target.targetPresent()) {
            return null;
        }
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

    private @Nullable CorridorPointProjection corridorPointProjection() {
        DungeonEditorStatePanelCorridorPointDrafts.Draft draft = currentFrame.corridorPointDraft();
        if (!draft.targetPresent()) {
            return null;
        }
        return new CorridorPointProjection(
                draft.label(),
                draft.q(),
                draft.r(),
                draft.level());
    }

    private @Nullable TransitionDescriptionProjection transitionDescriptionProjection(
            DungeonEditorTopologyElementRef topologyRef,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        DungeonEditorStatePanelTransitionDescriptionDrafts.Draft runtimeDraft =
                currentFrame.transitionDescriptionDraft();
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
        return new TransitionDescriptionProjection(topologyRef.id(), title, draft);
    }

    private @Nullable TransitionDestinationProjection transitionDestinationProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame,
            DungeonEditorTopologyElementRef topologyRef,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (frame.selectedMapIdValue() <= NO_SELECTED_MAP_ID) {
            return null;
        }
        long selectedTransitionId = selectedTransitionId(topologyRef);
        if (!TRANSITION_CREATE_TOOL.equals(frame.selectedToolKey()) && selectedTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        DungeonEditorStatePanelTransitionDestinationDrafts.Draft runtimeDraft =
                frame.transitionDestinationDraft();
        if (!runtimeDraft.targetPresent()) {
            return null;
        }
        TransitionDestinationDraft baseline = TransitionDestinationDraft.fromInspector(inspector);
        TransitionDestinationDraft draft = runtimeDraft.present()
                ? TransitionDestinationDraft.fromRuntimeDraft(runtimeDraft)
                : baseline;
        return new TransitionDestinationProjection(
                runtimeDraft.sourceTransitionId() > NO_TRANSITION_ID ? "Übergang-Ziel / Eingangslink" : "Übergang-Ziel",
                runtimeDraft.sourceTransitionId(),
                draft.destinationTypeKey(),
                draft.mapId(),
                draft.tileId(),
                draft.transitionId(),
                draft.bidirectional(),
                frame.busy());
    }

    private static long selectedTransitionId(DungeonEditorTopologyElementRef topologyRef) {
        DungeonEditorTopologyElementRef safeTopologyRef = topologyRef == null
                ? DungeonEditorTopologyElementRef.empty()
                : topologyRef;
        return "TRANSITION".equals(safeTopologyRef.kind()) ? safeTopologyRef.id() : 0L;
    }

    private static long selectedStairId(DungeonEditorTopologyElementRef topologyRef) {
        DungeonEditorTopologyElementRef safeTopologyRef = topologyRef == null
                ? DungeonEditorTopologyElementRef.empty()
                : topologyRef;
        return STAIR_KIND.equals(safeTopologyRef.kind()) ? safeTopologyRef.id() : 0L;
    }

    private @Nullable StairGeometryProjection stairGeometryProjection(
            DungeonEditorTopologyElementRef topologyRef,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        long stairId = selectedStairId(topologyRef);
        if (stairId <= 0L || inspector == null) {
            return null;
        }
        StairGeometryFacts facts = StairGeometryFacts.from(inspector.facts());
        if (facts == null) {
            return null;
        }
        StairGeometryFacts draft = currentStairGeometryFacts(stairId, facts);
        String label = inspector.title().isBlank() ? "Treppe " + stairId : inspector.title();
        return new StairGeometryProjection(
                stairId,
                label,
                draft.shapeName(),
                draft.directionName(),
                draft.dimension1(),
                draft.dimension2());
    }

    private StairGeometryFacts currentStairGeometryFacts(long stairId, StairGeometryFacts fallback) {
        DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft =
                currentFrame.stairGeometryDraft();
        if (!runtimeStairDraftMatches(runtimeDraft, stairId)) {
            return fallback;
        }
        return new StairGeometryFacts(
                runtimeDraft.shapeName(),
                runtimeDraft.directionName(),
                runtimeDraft.dimension1(),
                runtimeDraft.dimension2());
    }

    private static boolean runtimeStairDraftMatches(
            DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft,
            long stairId
    ) {
        return runtimeDraft.present() && runtimeDraft.targetPresent() && runtimeDraft.stairId() == stairId;
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
            destinationTypeKey = normalizeDestinationTypeKey(destinationTypeKey);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
        }

        TransitionDestinationControlState controlState() {
            return controlStateFor(destinationTypeKey, mapId, transitionId);
        }

        List<String> destinationTypeLabels() {
            return DESTINATION_TYPE_OPTIONS.stream()
                    .map(DestinationTypeOption::label)
                    .toList();
        }

        String selectedDestinationTypeLabel() {
            return destinationTypeLabel(destinationTypeKey);
        }

        String linkTargetHintText() {
            return "Eingangslink: Dungeon-Eingang als Ziel wählen";
        }

        TransitionDestinationControlState controlStateForOptionIndex(
                int selectedDestinationTypeOptionIndex,
                String candidateMapId,
                String candidateTransitionId
        ) {
            return controlStateFor(
                    transitionDestinationTypeKey(selectedDestinationTypeOptionIndex),
                    candidateMapId,
                    candidateTransitionId);
        }

        TransitionDestinationControlState controlStateFor(
                String selectedDestinationTypeKey,
                String candidateMapId,
                String candidateTransitionId
        ) {
            String safeDestinationType = normalizeDestinationTypeKey(selectedDestinationTypeKey);
            boolean linkMode = sourceTransitionId > NO_TRANSITION_ID;
            boolean dungeonMapDestination = DESTINATION_DUNGEON_MAP.equals(safeDestinationType);
            boolean unlinkedEntrance = DESTINATION_UNLINKED_ENTRANCE.equals(safeDestinationType);
            boolean readOnlySelectedOverworld = linkMode
                    && !dungeonMapDestination
                    && !unlinkedEntrance;
            boolean targetFieldsComplete = completeIntegerText(candidateMapId)
                    && completeIntegerText(candidateTransitionId);
            return new TransitionDestinationControlState(
                    linkMode,
                    busy,
                    mapIdDisabled(busy, readOnlySelectedOverworld, unlinkedEntrance),
                    tileIdDisabled(busy, dungeonMapDestination, readOnlySelectedOverworld, unlinkedEntrance),
                    transitionIdDisabled(busy, dungeonMapDestination, unlinkedEntrance),
                    bidirectionalDisabled(busy, linkMode, dungeonMapDestination),
                    readOnlySelectedOverworld || unlinkedEntrance,
                    tileIdLabelDisabled(dungeonMapDestination, readOnlySelectedOverworld, unlinkedEntrance),
                    !dungeonMapDestination || unlinkedEntrance,
                    saveDisabled(busy, linkMode, dungeonMapDestination, targetFieldsComplete));
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

    private record DestinationTypeOption(String key, String label) {
        DestinationTypeOption {
            key = key == null ? "" : key.strip().toUpperCase(Locale.ROOT);
            label = label == null || label.isBlank() ? key : label;
        }
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
            DungeonInspectorSnapshot.RoomExitNarration safeExit = exit == null
                    ? new DungeonInspectorSnapshot.RoomExitNarration("", null, "", "")
                    : exit;
            return new RoomExitKey(
                    safeExit.label(),
                    safeExit.cell().q(),
                    safeExit.cell().r(),
                    safeExit.cell().level(),
                    safeExit.direction());
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

        static TransitionDestinationDraft fromInspector(@Nullable DungeonInspectorSnapshot inspector) {
            if (inspector == null || inspector.facts().isEmpty()) {
                return defaultDraft();
            }
            Map<String, String> facts = factMap(inspector.facts());
            return new TransitionDestinationDraft(
                    normalizeDestinationTypeKey(facts.get("destinationtype")),
                    facts.getOrDefault("destinationmapid", ""),
                    facts.getOrDefault("destinationtileid", ""),
                    facts.getOrDefault("destinationtransitionid", ""),
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

        private static @Nullable StairGeometryFacts from(List<String> facts) {
            Map<String, String> values = factMap(facts);
            String shape = values.get("shape");
            String direction = values.get("direction");
            String dimension1 = values.get("dimension1");
            String dimension2 = values.get("dimension2");
            if (shape == null || direction == null || dimension1 == null || dimension2 == null) {
                return null;
            }
            return new StairGeometryFacts(shape, direction, dimension1, dimension2);
        }
    }

    static Map<String, String> factMap(List<String> facts) {
        Map<String, String> values = new HashMap<>();
        for (String fact : facts == null ? List.<String>of() : facts) {
            int separator = fact.indexOf(':');
            if (separator > 0) {
                values.put(
                        fact.substring(0, separator).strip().toLowerCase(Locale.ROOT),
                        fact.substring(separator + 1).strip());
            }
        }
        return values;
    }

    static String normalizeDestinationTypeKey(String value) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        return destinationTypeOptionIndex(normalized) >= 0 ? normalized : DESTINATION_UNLINKED_ENTRANCE;
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

    private static String destinationTypeLabel(String key) {
        int index = destinationTypeOptionIndex(key);
        return index >= 0 ? DESTINATION_TYPE_OPTIONS.get(index).label() : DESTINATION_TYPE_OPTIONS.getFirst().label();
    }

    private static boolean completeIntegerText(String text) {
        return text != null && !text.isBlank() && !"-".equals(text);
    }

    private static final class ProjectionTextSupport {
        private static String stateTextFor(DungeonEditorPreparedFrameFacts.StatePanelFrame frame) {
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

    private static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return "Graph".equals(viewModeKey) ? "Graph" : "Grid";
    }

    private static String roomRectangleLabel(boolean deleteMode) {
        return deleteMode ? "Raum löschen" : "Raum malen";
    }
}
