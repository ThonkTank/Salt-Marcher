package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDescriptionDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelTransitionDestinationDrafts;

final class DungeonEditorStateTransitionContentPartModel {
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

    DungeonEditorStateContentModel.@Nullable TransitionDescriptionProjection transitionDescriptionProjection(
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
        return new DungeonEditorStateContentModel.TransitionDescriptionProjection(
                topologyRef.id(),
                title,
                draft);
    }

    DungeonEditorStateContentModel.@Nullable TransitionDestinationProjection transitionDestinationProjection(
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
        return new DungeonEditorStateContentModel.TransitionDestinationProjection(
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

    static DungeonEditorStateContentModel.TransitionDestinationControlState controlStateFor(
            DungeonEditorStateContentModel.TransitionDestinationProjection projection,
            String selectedDestinationTypeKey,
            String candidateMapId,
            String candidateTransitionId
    ) {
        DungeonEditorStateContentModel.TransitionDestinationProjection safeProjection = projection == null
                ? new DungeonEditorStateContentModel.TransitionDestinationProjection(
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
        return new DungeonEditorStateContentModel.TransitionDestinationControlState(
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
