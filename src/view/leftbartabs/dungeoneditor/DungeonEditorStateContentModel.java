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
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.features.dungeon.runtime.DungeonEditorStatePanelCorridorPointDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelLabelNameDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelRoomNarrationDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDescriptionDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDestinationDrafts;

final class DungeonEditorStateContentModel {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_STAIR_ID = 0L;
    private static final long NO_SELECTED_MAP_ID = 0L;
    private static final String STAIR_KIND = "STAIR";
    private static final String OVERWORLD_TILE_DESTINATION = "OVERWORLD_TILE";
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";

    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final Map<StairGeometryDraftKey, StairGeometryDraft> stairGeometryDrafts = new HashMap<>();
    private StateProjectionContext currentContext = StateProjectionContext.empty();
    private long currentSelectedTransitionId;

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
        List<RoomNarrationCardProjection> narrationCards = narrationCards(
                safeSnapshot.inspector(),
                safeContext.statePanelRoomNarrationDrafts());
        String narrationRenderStructureKey = narrationRenderStructureKey(
                narrationCards,
                safeContext.busy(),
                safeContext.statusText());
        TransitionDescriptionProjection transitionDescription = transitionDescriptionProjection(
                safeSnapshot.selection(),
                safeSnapshot.inspector());
        TransitionDestinationProjection transitionDestination = transitionDestinationProjection(
                safeContext,
                safeSnapshot.selection(),
                safeSnapshot.inspector());
        StairGeometryProjection stairGeometry = stairGeometryProjection(
                safeContext.selectedMapIdValue(),
                safeSnapshot.selection(),
                safeSnapshot.inspector());
        currentSelectedTransitionId = selectedTransitionId(safeSnapshot.selection());
        pruneStairGeometryDrafts(
                safeContext.selectedMapIdValue(),
                stairGeometry);
        stateProjection.set(new StateProjection(
                ProjectionTextSupport.stateTextFor(safeSnapshot, safeContext),
                safeContext.statusText(),
                safeContext.busy(),
                narrationRenderStructureKey,
                narrationCards,
                nameProjection(safeSnapshot.inspector()),
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

    String currentTransitionDestinationType() {
        return currentTransitionDestinationProjection().destinationType();
    }

    long currentTransitionDestinationMapId() {
        return positiveLong(currentTransitionDestinationProjection().mapId());
    }

    long currentTransitionDestinationTileId() {
        return positiveLong(currentTransitionDestinationProjection().tileId());
    }

    long currentTransitionDestinationTransitionId() {
        return positiveLong(currentTransitionDestinationProjection().transitionId());
    }

    long currentSelectedTransitionId() {
        return currentSelectedTransitionId;
    }

    private TransitionDestinationProjection currentTransitionDestinationProjection() {
        StateProjection currentProjection = stateProjection.get();
        return currentProjection == null || currentProjection.transitionDestination() == null
                ? new TransitionDestinationProjection("Übergang-Ziel", 0L, OVERWORLD_TILE_DESTINATION, "", "", "", true)
                : currentProjection.transitionDestination();
    }

    void updateStairGeometryDraft(
            long stairId,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        if (stairId <= NO_STAIR_ID) {
            return;
        }
        stairGeometryDrafts.put(
                new StairGeometryDraftKey(currentContext.selectedMapIdValue(), stairId),
                new StairGeometryDraft(shapeName, directionName, dimension1, dimension2));
    }

    void clearStairGeometryDraft(long stairId) {
        stairGeometryDrafts.remove(new StairGeometryDraftKey(currentContext.selectedMapIdValue(), stairId));
    }

    private void pruneStairGeometryDrafts(
            long selectedMapIdValue,
            @Nullable StairGeometryProjection stairGeometry
    ) {
        StairGeometryDraftKey visibleStair = stairGeometry == null
                ? null
                : new StairGeometryDraftKey(selectedMapIdValue, stairGeometry.stairId());
        stairGeometryDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !key.equals(visibleStair));
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
        DungeonEditorStatePanelLabelNameDrafts.Draft target = currentContext.statePanelLabelNameDraft();
        if (!target.targetPresent()) {
            return null;
        }
        String fallbackName = target.fallbackName();
        String currentName = inspector == null || inspector.title().isBlank() ? fallbackName : inspector.title();
        String draft = target.present()
                ? target.name()
                : currentName;
        return new NameProjection(
                target.targetKind(),
                target.targetId(),
                target.label(),
                draft);
    }

    private @Nullable CorridorPointProjection corridorPointProjection() {
        DungeonEditorStatePanelCorridorPointDrafts.Draft draft = currentContext.statePanelCorridorPointDraft();
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
            DungeonEditorStateSnapshot.Selection selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        DungeonEditorStatePanelTransitionDescriptionDrafts.Draft runtimeDraft =
                currentContext.statePanelTransitionDescriptionDraft();
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
            StateProjectionContext context,
            DungeonEditorStateSnapshot.Selection selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (context.selectedMapIdValue() <= NO_SELECTED_MAP_ID) {
            return null;
        }
        long selectedTransitionId = selectedTransitionId(selection);
        if (!TRANSITION_CREATE_TOOL.equals(context.selectedToolKey()) && selectedTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        DungeonEditorStatePanelTransitionDestinationDrafts.Draft runtimeDraft =
                context.statePanelTransitionDestinationDraft();
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
                draft.destinationType(),
                draft.mapId(),
                draft.tileId(),
                draft.transitionId(),
                draft.bidirectional());
    }

    private static long selectedTransitionId(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        return "TRANSITION".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    private @Nullable StairGeometryProjection stairGeometryProjection(
            long selectedMapIdValue,
            DungeonEditorStateSnapshot.Selection selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        if (!STAIR_KIND.equals(topologyRef.kind()) || topologyRef.id() <= 0L || inspector == null) {
            return null;
        }
        StairGeometryDraft model = StairGeometryDraft.fromFacts(inspector.facts());
        if (model == null) {
            return null;
        }
        StairGeometryDraft draft = stairGeometryDrafts.getOrDefault(
                new StairGeometryDraftKey(selectedMapIdValue, topologyRef.id()),
                model);
        String label = inspector.title().isBlank() ? "Treppe " + topologyRef.id() : inspector.title();
        return new StairGeometryProjection(
                topologyRef.id(),
                label,
                draft.shapeName(),
                draft.directionName(),
                draft.dimension1(),
                draft.dimension2());
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

    record NameProjection(String targetKind, long targetId, String label, String name) {
        NameProjection {
            targetKind = targetKind == null ? "" : targetKind;
            targetId = Math.max(0L, targetId);
            label = label == null || label.isBlank() ? "Name" : label;
            name = name == null ? "" : name;
        }
    }

    record StateProjectionContext(
            long selectedMapIdValue,
            String statusText,
            boolean busy,
            String selectedToolLabel,
            String selectedToolKey,
            String viewModeLabel,
            int projectionLevel,
            String overlayLabel,
            DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts statePanelRoomNarrationDrafts,
            DungeonEditorStatePanelLabelNameDrafts.Draft statePanelLabelNameDraft,
            DungeonEditorStatePanelCorridorPointDrafts.Draft statePanelCorridorPointDraft,
            DungeonEditorStatePanelTransitionDescriptionDrafts.Draft statePanelTransitionDescriptionDraft,
            DungeonEditorStatePanelTransitionDestinationDrafts.Draft statePanelTransitionDestinationDraft
    ) {
        StateProjectionContext {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            statusText = statusText == null ? "" : statusText;
            selectedToolLabel = selectedToolLabel == null ? "Auswahl" : selectedToolLabel;
            selectedToolKey = selectedToolKey == null ? "" : selectedToolKey;
            viewModeLabel = normalizeViewModeKey(viewModeLabel);
            projectionLevel = Math.max(0, projectionLevel);
            overlayLabel = overlayLabel == null ? "" : overlayLabel;
            statePanelRoomNarrationDrafts = statePanelRoomNarrationDrafts == null
                    ? DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty()
                    : statePanelRoomNarrationDrafts;
            statePanelLabelNameDraft = statePanelLabelNameDraft == null
                    ? DungeonEditorStatePanelLabelNameDrafts.Draft.empty()
                    : statePanelLabelNameDraft;
            statePanelCorridorPointDraft = statePanelCorridorPointDraft == null
                    ? DungeonEditorStatePanelCorridorPointDrafts.Draft.empty()
                    : statePanelCorridorPointDraft;
            statePanelTransitionDescriptionDraft = statePanelTransitionDescriptionDraft == null
                    ? DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty()
                    : statePanelTransitionDescriptionDraft;
            statePanelTransitionDestinationDraft = statePanelTransitionDestinationDraft == null
                    ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty()
                    : statePanelTransitionDestinationDraft;
        }

        static StateProjectionContext empty() {
            return new StateProjectionContext(
                    0L,
                    "",
                    false,
                    "Auswahl",
                    "",
                    "Grid",
                    0,
                    "",
                    DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty(),
                    DungeonEditorStatePanelLabelNameDrafts.Draft.empty(),
                    DungeonEditorStatePanelCorridorPointDrafts.Draft.empty(),
                    DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty(),
                    DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty());
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
            String destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        TransitionDestinationProjection {
            label = label == null || label.isBlank() ? "Übergang-Ziel" : label;
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            destinationType = transitionDestinationType(destinationType);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
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
            String destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        TransitionDestinationDraft {
            destinationType = transitionDestinationType(destinationType);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
        }

        static TransitionDestinationDraft defaultDraft() {
            return new TransitionDestinationDraft(OVERWORLD_TILE_DESTINATION, "", "", "", true);
        }

        static TransitionDestinationDraft fromInspector(@Nullable DungeonInspectorSnapshot inspector) {
            if (inspector == null || inspector.facts().isEmpty()) {
                return defaultDraft();
            }
            Map<String, String> facts = factMap(inspector.facts());
            return new TransitionDestinationDraft(
                    facts.getOrDefault("destinationtype", OVERWORLD_TILE_DESTINATION),
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
                    safeDraft.destinationType(),
                    safeDraft.mapId(),
                    safeDraft.tileId(),
                    safeDraft.transitionId(),
                    safeDraft.bidirectional());
        }
    }

    private record StairGeometryDraftKey(long selectedMapIdValue, long stairId) {
        StairGeometryDraftKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            stairId = Math.max(0L, stairId);
        }
    }

    private record StairGeometryDraft(
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        StairGeometryDraft {
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = dimension1 == null ? "" : dimension1.strip();
            dimension2 = dimension2 == null ? "" : dimension2.strip();
        }

        private static @Nullable StairGeometryDraft fromFacts(List<String> facts) {
            Map<String, String> values = factMap(facts);
            String shape = values.get("shape");
            String direction = values.get("direction");
            String dimension1 = values.get("dimension1");
            String dimension2 = values.get("dimension2");
            if (shape == null || direction == null || dimension1 == null || dimension2 == null) {
                return null;
            }
            return new StairGeometryDraft(shape, direction, dimension1, dimension2);
        }
    }

    private static Map<String, String> factMap(List<String> facts) {
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

    private static String transitionDestinationType(String value) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return OVERWORLD_TILE_DESTINATION;
        }
        if ("DUNGEON_MAP".equals(normalized) || OVERWORLD_TILE_DESTINATION.equals(normalized)) {
            return normalized;
        }
        return normalized;
    }

    private static long positiveLong(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Math.max(0L, Long.parseLong(value.strip()));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static final class ProjectionTextSupport {
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

    private static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return "Graph".equals(viewModeKey) ? "Graph" : "Grid";
    }

    private static String roomRectangleLabel(boolean deleteMode) {
        return deleteMode ? "Raum löschen" : "Raum malen";
    }
}
