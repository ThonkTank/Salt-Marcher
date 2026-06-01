package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorStateViewInputEvent(
        long roomId,
        String visualDescription,
        List<String> exitDescriptions,
        boolean narrationSaveRequested,
        String corridorPointQ,
        String corridorPointR,
        boolean corridorPointInputObserved,
        boolean corridorPointSubmitRequested,
        long transitionId,
        String transitionDescription,
        boolean transitionDescriptionInputObserved,
        boolean transitionDescriptionSaveRequested,
        String transitionDestinationType,
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
        corridorPointQ = corridorPointQ == null ? "" : corridorPointQ;
        corridorPointR = corridorPointR == null ? "" : corridorPointR;
        transitionId = Math.max(0L, transitionId);
        transitionDescription = transitionDescription == null ? "" : transitionDescription;
        transitionDestinationType = transitionDestinationType == null ? "" : transitionDestinationType;
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
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                "",
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
                corridorPointQ,
                corridorPointR,
                true,
                corridorPointSubmitRequested,
                0L,
                "",
                false,
                false,
                "",
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
                "",
                false,
                false,
                transitionId,
                description,
                true,
                saveRequested,
                "",
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
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                "",
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
            String transitionDestinationType,
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
                "",
                false,
                false,
                0L,
                "",
                false,
                false,
                transitionDestinationType,
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
