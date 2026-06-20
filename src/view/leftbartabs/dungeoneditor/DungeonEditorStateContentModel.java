package src.view.leftbartabs.dungeoneditor;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.features.dungeon.runtime.DungeonEditorStatePanelCorridorPointDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelLabelNameDrafts;

final class DungeonEditorStateContentModel {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_STAIR_ID = 0L;
    private static final long NO_SELECTED_MAP_ID = 0L;
    private static final String STAIR_KIND = "STAIR";
    private static final String OVERWORLD_TILE_DESTINATION = "OVERWORLD_TILE";
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";

    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final Map<VisualDraftKey, String> visualDrafts = new HashMap<>();
    private final Map<ExitDraftKey, String> exitDrafts = new HashMap<>();
    private final Map<TransitionDraftKey, String> transitionDrafts = new HashMap<>();
    private final Map<TransitionDestinationDraftKey, TransitionDestinationDraft> transitionDestinationDrafts =
            new HashMap<>();
    private final Map<StairGeometryDraftKey, StairGeometryDraft> stairGeometryDrafts = new HashMap<>();
    private StateProjectionContext currentContext = StateProjectionContext.empty();
    private TransitionDestinationDraft currentTransitionDestinationBaseline = TransitionDestinationDraft.defaultDraft();
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
        List<RoomNarrationCardProjection> narrationCards =
                ProjectionTextSupport.toNarrationCards(safeSnapshot.inspector());
        TransitionDescriptionProjection transitionDescription = transitionDescriptionProjection(
                safeContext.selectedMapIdValue(),
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
        currentTransitionDestinationBaseline = transitionDestination == null
                ? TransitionDestinationDraft.defaultDraft()
                : TransitionDestinationDraft.fromProjection(transitionDestination);
        currentSelectedTransitionId = selectedTransitionId(safeSnapshot.selection());
        pruneDrafts(
                safeContext.selectedMapIdValue(),
                narrationCards,
                transitionDescription,
                stairGeometry);
        stateProjection.set(new StateProjection(
                ProjectionTextSupport.stateTextFor(safeSnapshot, safeContext),
                safeContext.statusText(),
                safeContext.busy(),
                applyDrafts(safeContext.selectedMapIdValue(), narrationCards),
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

    void updateNarrationDraft(long roomId, String visualDescription, List<String> exitDescriptions) {
        RoomNarrationCardProjection card = currentNarrationCard(roomId);
        if (card == null) {
            return;
        }
        long selectedMapIdValue = currentContext.selectedMapIdValue();
        visualDrafts.put(new VisualDraftKey(selectedMapIdValue, card.roomId()),
                visualDescription == null ? "" : visualDescription);
        List<String> descriptions = exitDescriptions == null ? List.of() : exitDescriptions;
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

    void updateTransitionDescriptionDraft(long transitionId, String description) {
        if (transitionId <= NO_TRANSITION_ID) {
            return;
        }
        transitionDrafts.put(
                new TransitionDraftKey(currentContext.selectedMapIdValue(), transitionId),
                description == null ? "" : description);
    }

    void clearTransitionDescriptionDraft(long transitionId) {
        transitionDrafts.remove(new TransitionDraftKey(currentContext.selectedMapIdValue(), transitionId));
    }

    void updateTransitionDestinationDraft(
            String destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        long selectedMapIdValue = currentContext.selectedMapIdValue();
        if (selectedMapIdValue <= NO_SELECTED_MAP_ID) {
            return;
        }
        transitionDestinationDrafts.put(
                transitionDestinationDraftKey(selectedMapIdValue, currentSelectedTransitionId),
                new TransitionDestinationDraft(destinationType, mapId, tileId, transitionId, bidirectional));
    }

    String currentTransitionDestinationType() {
        return currentTransitionDestinationDraft().destinationType();
    }

    long currentTransitionDestinationMapId() {
        return positiveLong(currentTransitionDestinationDraft().mapId());
    }

    long currentTransitionDestinationTileId() {
        return positiveLong(currentTransitionDestinationDraft().tileId());
    }

    long currentTransitionDestinationTransitionId() {
        return positiveLong(currentTransitionDestinationDraft().transitionId());
    }

    long currentSelectedTransitionId() {
        return currentSelectedTransitionId;
    }

    private TransitionDestinationDraft currentTransitionDestinationDraft() {
        return transitionDestinationDrafts.getOrDefault(
                transitionDestinationDraftKey(currentContext.selectedMapIdValue(), currentSelectedTransitionId),
                currentTransitionDestinationBaseline);
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

    private void pruneDrafts(
            long selectedMapIdValue,
            List<RoomNarrationCardProjection> cards,
            @Nullable TransitionDescriptionProjection transitionDescription,
            @Nullable StairGeometryProjection stairGeometry
    ) {
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
        TransitionDraftKey visibleTransition = transitionDescription == null
                ? null
                : new TransitionDraftKey(selectedMapIdValue, transitionDescription.transitionId());
        transitionDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !key.equals(visibleTransition));
        StairGeometryDraftKey visibleStair = stairGeometry == null
                ? null
                : new StairGeometryDraftKey(selectedMapIdValue, stairGeometry.stairId());
        stairGeometryDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !key.equals(visibleStair));
        transitionDestinationDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == selectedMapIdValue
                && !key.equals(transitionDestinationDraftKey(selectedMapIdValue, currentSelectedTransitionId)));
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
            long selectedMapIdValue,
            DungeonEditorStateSnapshot.Selection selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        if (!"TRANSITION".equals(topologyRef.kind()) || topologyRef.id() <= 0L) {
            return null;
        }
        String title = inspector == null || inspector.title().isBlank()
                ? "Übergang " + topologyRef.id()
                : inspector.title();
        String description = inspector == null ? "" : inspector.summary();
        String draft = transitionDrafts.getOrDefault(
                new TransitionDraftKey(selectedMapIdValue, topologyRef.id()),
                description);
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
        TransitionDestinationDraft baseline = TransitionDestinationDraft.fromInspector(inspector);
        TransitionDestinationDraft draft = transitionDestinationDrafts.getOrDefault(
                transitionDestinationDraftKey(context.selectedMapIdValue(), selectedTransitionId),
                baseline);
        return new TransitionDestinationProjection(
                selectedTransitionId > NO_TRANSITION_ID ? "Übergang-Ziel / Eingangslink" : "Übergang-Ziel",
                selectedTransitionId,
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
            narrationCards = narrationCards == null ? List.of() : List.copyOf(narrationCards);
        }

        static StateProjection initial() {
            return new StateProjection("", "", false, List.of(), null, null, null, null, null);
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
            DungeonEditorStatePanelLabelNameDrafts.Draft statePanelLabelNameDraft,
            DungeonEditorStatePanelCorridorPointDrafts.Draft statePanelCorridorPointDraft
    ) {
        StateProjectionContext {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            statusText = statusText == null ? "" : statusText;
            selectedToolLabel = selectedToolLabel == null ? "Auswahl" : selectedToolLabel;
            selectedToolKey = selectedToolKey == null ? "" : selectedToolKey;
            viewModeLabel = normalizeViewModeKey(viewModeLabel);
            projectionLevel = Math.max(0, projectionLevel);
            overlayLabel = overlayLabel == null ? "" : overlayLabel;
            statePanelLabelNameDraft = statePanelLabelNameDraft == null
                    ? DungeonEditorStatePanelLabelNameDrafts.Draft.empty()
                    : statePanelLabelNameDraft;
            statePanelCorridorPointDraft = statePanelCorridorPointDraft == null
                    ? DungeonEditorStatePanelCorridorPointDrafts.Draft.empty()
                    : statePanelCorridorPointDraft;
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
                    DungeonEditorStatePanelLabelNameDrafts.Draft.empty(),
                    DungeonEditorStatePanelCorridorPointDrafts.Draft.empty());
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

    private record TransitionDraftKey(long selectedMapIdValue, long transitionId) {
        TransitionDraftKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            transitionId = Math.max(0L, transitionId);
        }
    }

    private record TransitionDestinationDraftKey(long selectedMapIdValue, long sourceTransitionId) {
        TransitionDestinationDraftKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            sourceTransitionId = Math.max(0L, sourceTransitionId);
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

        static TransitionDestinationDraft fromProjection(TransitionDestinationProjection projection) {
            return projection == null
                    ? defaultDraft()
                    : new TransitionDestinationDraft(
                            projection.destinationType(),
                            projection.mapId(),
                            projection.tileId(),
                            projection.transitionId(),
                            projection.bidirectional());
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

    private static TransitionDestinationDraftKey transitionDestinationDraftKey(
            long selectedMapIdValue,
            long sourceTransitionId
    ) {
        return new TransitionDestinationDraftKey(selectedMapIdValue, Math.max(0L, sourceTransitionId));
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
