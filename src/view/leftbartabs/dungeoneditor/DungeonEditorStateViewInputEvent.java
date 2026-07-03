package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorStateViewInputEvent(
        long roomId,
        String visualDescription,
        List<String> exitDescriptions,
        boolean narrationSaveRequested,
        String nameTargetKind,
        long nameTargetId,
        String labelName,
        boolean labelNameInputObserved,
        boolean labelNameSaveRequested,
        String corridorPointQ,
        String corridorPointR,
        boolean corridorPointInputObserved,
        boolean corridorPointSubmitRequested,
        long transitionId,
        String transitionDescription,
        boolean transitionDescriptionInputObserved,
        boolean transitionDescriptionSaveRequested,
        int transitionDestinationTypeOptionIndex,
        String transitionDestinationMapId,
        String transitionDestinationTileId,
        String transitionDestinationTransitionId,
        boolean transitionDestinationBidirectional,
        boolean transitionDestinationInputObserved,
        boolean transitionDestinationSaveRequested,
        long stairId,
        String stairShapeName,
        String stairDirectionName,
        String stairDimension1,
        String stairDimension2,
        boolean stairGeometryInputObserved,
        boolean stairGeometrySaveRequested
) {

    public DungeonEditorStateViewInputEvent {
        roomId = Math.max(0L, roomId);
        visualDescription = visualDescription == null ? "" : visualDescription;
        exitDescriptions = exitDescriptions == null
                ? List.of()
                : List.copyOf(exitDescriptions.stream()
                        .map(description -> description == null ? "" : description)
                        .toList());
        nameTargetKind = nameTargetKind == null ? "" : nameTargetKind;
        nameTargetId = Math.max(0L, nameTargetId);
        labelName = labelName == null ? "" : labelName;
        corridorPointQ = corridorPointQ == null ? "" : corridorPointQ;
        corridorPointR = corridorPointR == null ? "" : corridorPointR;
        transitionId = Math.max(0L, transitionId);
        transitionDescription = transitionDescription == null ? "" : transitionDescription;
        transitionDestinationTypeOptionIndex = Math.max(-1, transitionDestinationTypeOptionIndex);
        transitionDestinationMapId = transitionDestinationMapId == null ? "" : transitionDestinationMapId;
        transitionDestinationTileId = transitionDestinationTileId == null ? "" : transitionDestinationTileId;
        transitionDestinationTransitionId =
                transitionDestinationTransitionId == null ? "" : transitionDestinationTransitionId;
        stairId = Math.max(0L, stairId);
        stairShapeName = stairShapeName == null ? "" : stairShapeName;
        stairDirectionName = stairDirectionName == null ? "" : stairDirectionName;
        stairDimension1 = stairDimension1 == null ? "" : stairDimension1;
        stairDimension2 = stairDimension2 == null ? "" : stairDimension2;
    }

    public DungeonEditorStateViewInputEvent(
            long roomId,
            String visualDescription,
            List<String> exitDescriptions,
            boolean saveRequested
    ) {
        this(
                roomId,
                visualDescription,
                exitDescriptions,
                saveRequested,
                "",
                0L,
                "",
                false,
                false,
                "",
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                -1,
                "",
                "",
                "",
                false,
                false,
                false,
                0L,
                "",
                "",
                "",
                "",
                false,
                false);
    }

    public DungeonEditorStateViewInputEvent(
            String targetKind,
            long targetId,
            String labelName,
            boolean inputObserved,
            boolean saveRequested
    ) {
        this(
                0L,
                "",
                List.of(),
                false,
                targetKind,
                targetId,
                labelName,
                inputObserved,
                saveRequested,
                "",
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                -1,
                "",
                "",
                "",
                false,
                false,
                false,
                0L,
                "",
                "",
                "",
                "",
                false,
                false);
    }

    public DungeonEditorStateViewInputEvent(
            String corridorPointQ,
            String corridorPointR,
            boolean corridorPointSubmitRequested
    ) {
        this(
                0L,
                "",
                List.of(),
                false,
                "",
                0L,
                "",
                false,
                false,
                corridorPointQ,
                corridorPointR,
                true,
                corridorPointSubmitRequested,
                0L,
                "",
                false,
                false,
                -1,
                "",
                "",
                "",
                false,
                false,
                false,
                0L,
                "",
                "",
                "",
                "",
                false,
                false);
    }

    public DungeonEditorStateViewInputEvent(
            long transitionId,
            String description,
            boolean saveRequested
    ) {
        this(
                0L,
                "",
                List.of(),
                false,
                "",
                0L,
                "",
                false,
                false,
                "",
                "",
                false,
                false,
                transitionId,
                description,
                true,
                saveRequested,
                -1,
                "",
                "",
                "",
                false,
                false,
                false,
                0L,
                "",
                "",
                "",
                "",
                false,
                false);
    }

    public DungeonEditorStateViewInputEvent(
            long stairId,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2,
            boolean saveRequested
    ) {
        this(
                0L,
                "",
                List.of(),
                false,
                "",
                0L,
                "",
                false,
                false,
                "",
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                -1,
                "",
                "",
                "",
                false,
                false,
                false,
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                true,
                saveRequested);
    }

    public DungeonEditorStateViewInputEvent(
            int transitionDestinationTypeOptionIndex,
            String transitionDestinationMapId,
            String transitionDestinationTileId,
            String transitionDestinationTransitionId,
            boolean bidirectional,
            boolean saveRequested
    ) {
        this(
                0L,
                "",
                List.of(),
                false,
                "",
                0L,
                "",
                false,
                false,
                "",
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                transitionDestinationTypeOptionIndex,
                transitionDestinationMapId,
                transitionDestinationTileId,
                transitionDestinationTransitionId,
                bidirectional,
                true,
                saveRequested,
                0L,
                "",
                "",
                "",
                "",
                false,
                false);
    }
}
