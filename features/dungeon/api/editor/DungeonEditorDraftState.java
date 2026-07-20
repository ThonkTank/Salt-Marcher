package features.dungeon.api.editor;

import java.util.List;

/** Immutable drafts that belong to one editor-state publication. */
public record DungeonEditorDraftState(
        List<RoomNarrationDraft> roomNarrations,
        LabelNameDraft labelName,
        CorridorPointDraft corridorPoint,
        TransitionDescriptionDraft transitionDescription,
        TransitionDestinationDraft transitionDestination,
        StairGeometryDraft stairGeometry,
        InlineLabelDraft inlineLabel
) {
    public DungeonEditorDraftState {
        roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        labelName = labelName == null ? LabelNameDraft.empty() : labelName;
        corridorPoint = corridorPoint == null ? CorridorPointDraft.empty() : corridorPoint;
        transitionDescription = transitionDescription == null
                ? TransitionDescriptionDraft.empty()
                : transitionDescription;
        transitionDestination = transitionDestination == null
                ? TransitionDestinationDraft.empty()
                : transitionDestination;
        stairGeometry = stairGeometry == null ? StairGeometryDraft.empty() : stairGeometry;
        inlineLabel = inlineLabel == null ? InlineLabelDraft.empty() : inlineLabel;
    }

    public static DungeonEditorDraftState empty() {
        return new DungeonEditorDraftState(
                List.of(), null, null, null, null, null, null);
    }

    public record RoomNarrationDraft(
            long roomId,
            boolean visualPresent,
            String visualDescription,
            List<ExitNarrationDraft> exits
    ) {
        public RoomNarrationDraft {
            roomId = Math.max(0L, roomId);
            visualDescription = safeText(visualDescription);
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record ExitNarrationDraft(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description,
            boolean present
    ) {
        public ExitNarrationDraft {
            label = safeText(label);
            direction = safeText(direction);
            description = safeText(description);
        }
    }

    public record LabelNameDraft(
            String targetKind,
            long targetId,
            String label,
            String fallbackName,
            String name,
            boolean present
    ) {
        public LabelNameDraft {
            targetKind = safeText(targetKind);
            targetId = Math.max(0L, targetId);
            label = safeText(label);
            fallbackName = safeText(fallbackName);
            name = safeText(name);
            present = present && targetId > 0L;
        }

        public static LabelNameDraft empty() {
            return new LabelNameDraft("", 0L, "", "", "", false);
        }
    }

    public record CorridorPointDraft(
            boolean targetPresent,
            boolean present,
            String label,
            String q,
            String r,
            String level
    ) {
        public CorridorPointDraft {
            label = safeText(label);
            q = safeText(q);
            r = safeText(r);
            level = safeText(level);
            present = present && targetPresent;
        }

        public static CorridorPointDraft empty() {
            return new CorridorPointDraft(false, false, "", "", "", "");
        }
    }

    public record TransitionDescriptionDraft(long transitionId, String description, boolean present) {
        public TransitionDescriptionDraft {
            transitionId = Math.max(0L, transitionId);
            description = safeText(description);
            present = present && transitionId > 0L;
        }

        public static TransitionDescriptionDraft empty() {
            return new TransitionDescriptionDraft(0L, "", false);
        }
    }

    public record TransitionDestinationDraft(
            boolean targetPresent,
            long sourceTransitionId,
            String destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional,
            boolean present
    ) {
        public TransitionDestinationDraft {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            destinationType = safeText(destinationType);
            mapId = safeText(mapId);
            tileId = safeText(tileId);
            transitionId = safeText(transitionId);
            present = present && targetPresent;
        }

        public static TransitionDestinationDraft empty() {
            return new TransitionDestinationDraft(false, 0L, "", "", "", "", true, false);
        }
    }

    public record StairGeometryDraft(
            boolean targetPresent,
            long stairId,
            String shape,
            String direction,
            String dimension1,
            String dimension2,
            boolean present
    ) {
        public StairGeometryDraft {
            stairId = Math.max(0L, stairId);
            shape = safeText(shape);
            direction = safeText(direction);
            dimension1 = safeText(dimension1);
            dimension2 = safeText(dimension2);
            present = present && targetPresent && stairId > 0L;
        }

        public static StairGeometryDraft empty() {
            return new StairGeometryDraft(false, 0L, "", "", "", "", false);
        }
    }

    public record InlineLabelDraft(
            boolean active,
            String targetKind,
            long targetId,
            String labelKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            String text
    ) {
        public InlineLabelDraft {
            targetKind = safeText(targetKind);
            targetId = Math.max(0L, targetId);
            labelKind = safeText(labelKind);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = safeText(topologyKind);
            topologyId = Math.max(0L, topologyId);
            text = safeText(text);
            active = active && targetId > 0L;
        }

        public static InlineLabelDraft empty() {
            return new InlineLabelDraft(false, "", 0L, "", 0L, 0L, "", 0L, "");
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
