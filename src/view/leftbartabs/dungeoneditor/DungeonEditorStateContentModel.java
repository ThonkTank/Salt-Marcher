package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorStatePanelCorridorPointDrafts;
import src.features.dungeon.runtime.DungeonEditorStatePanelLabelNameDrafts;

final class DungeonEditorStateContentModel {
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final DungeonEditorStateNarrationContentPartModel narrationContent =
            new DungeonEditorStateNarrationContentPartModel();
    private final DungeonEditorStateTransitionContentPartModel transitionContent =
            new DungeonEditorStateTransitionContentPartModel();
    private final DungeonEditorStateStairGeometryContentPartModel stairGeometryContent =
            new DungeonEditorStateStairGeometryContentPartModel();
    private final DungeonEditorStateSelectionPreviewContentPartModel selectionPreviewContent =
            new DungeonEditorStateSelectionPreviewContentPartModel();

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
        return DungeonEditorStateTransitionContentPartModel.transitionDestinationTypeKey(optionIndex);
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
            destinationTypeKey = DungeonEditorStateTransitionContentPartModel.normalizeDestinationTypeKey(
                    destinationTypeKey);
            mapId = mapId == null ? "" : mapId.strip();
            tileId = tileId == null ? "" : tileId.strip();
            transitionId = transitionId == null ? "" : transitionId.strip();
        }

        TransitionDestinationControlState controlState() {
            return controlStateFor(destinationTypeKey, mapId, transitionId);
        }

        List<String> destinationTypeLabels() {
            return DungeonEditorStateTransitionContentPartModel.destinationTypeLabels();
        }

        String selectedDestinationTypeLabel() {
            return DungeonEditorStateTransitionContentPartModel.destinationTypeLabel(destinationTypeKey);
        }

        String linkTargetHintText() {
            return DungeonEditorStateTransitionContentPartModel.linkTargetHintText();
        }

        TransitionDestinationControlState controlStateForOptionIndex(
                int selectedDestinationTypeOptionIndex,
                String candidateMapId,
                String candidateTransitionId
        ) {
            return controlStateFor(
                    DungeonEditorStateTransitionContentPartModel.transitionDestinationTypeKey(
                            selectedDestinationTypeOptionIndex),
                    candidateMapId,
                    candidateTransitionId);
        }

        TransitionDestinationControlState controlStateFor(
                String selectedDestinationTypeKey,
                String candidateMapId,
                String candidateTransitionId
        ) {
            return DungeonEditorStateTransitionContentPartModel.controlStateFor(
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
}
