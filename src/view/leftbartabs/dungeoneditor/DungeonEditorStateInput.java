package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Locale;

record DungeonEditorStateInput(
        NarrationInput narration,
        LabelNameInput labelName,
        CorridorPointInput corridorPoint,
        TransitionDestinationInput transitionDestination,
        TransitionDescriptionInput transitionDescription,
        StairGeometryInput stairGeometry
) {

    DungeonEditorStateInput {
        narration = narration == null ? NarrationInput.none() : narration;
        labelName = labelName == null ? LabelNameInput.none() : labelName;
        corridorPoint = corridorPoint == null ? CorridorPointInput.none() : corridorPoint;
        transitionDestination = transitionDestination == null
                ? TransitionDestinationInput.none()
                : transitionDestination;
        transitionDescription = transitionDescription == null
                ? TransitionDescriptionInput.none()
                : transitionDescription;
        stairGeometry = stairGeometry == null ? StairGeometryInput.none() : stairGeometry;
    }

    static DungeonEditorStateInput narration(
            long roomId,
            String visualDescription,
            List<String> exitDescriptions,
            boolean saveRequested
    ) {
        return new DungeonEditorStateInput(
                new NarrationInput(roomId, visualDescription, exitDescriptions, saveRequested),
                LabelNameInput.none(),
                CorridorPointInput.none(),
                TransitionDestinationInput.none(),
                TransitionDescriptionInput.none(),
                StairGeometryInput.none());
    }

    static DungeonEditorStateInput labelName(
            String name,
            boolean inputObserved,
            boolean saveRequested
    ) {
        return new DungeonEditorStateInput(
                NarrationInput.none(),
                new LabelNameInput(name, inputObserved, saveRequested),
                CorridorPointInput.none(),
                TransitionDestinationInput.none(),
                TransitionDescriptionInput.none(),
                StairGeometryInput.none());
    }

    static DungeonEditorStateInput corridorPoint(
            String q,
            String r,
            boolean submitRequested
    ) {
        return new DungeonEditorStateInput(
                NarrationInput.none(),
                LabelNameInput.none(),
                new CorridorPointInput(q, r, true, submitRequested),
                TransitionDestinationInput.none(),
                TransitionDescriptionInput.none(),
                StairGeometryInput.none());
    }

    static DungeonEditorStateInput transitionDescription(
            long transitionId,
            String description,
            boolean saveRequested
    ) {
        return new DungeonEditorStateInput(
                NarrationInput.none(),
                LabelNameInput.none(),
                CorridorPointInput.none(),
                TransitionDestinationInput.none(),
                new TransitionDescriptionInput(transitionId, description, true, saveRequested),
                StairGeometryInput.none());
    }

    static DungeonEditorStateInput transitionDestination(
            int destinationOptionIndex,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional,
            boolean saveRequested
    ) {
        return new DungeonEditorStateInput(
                NarrationInput.none(),
                LabelNameInput.none(),
                CorridorPointInput.none(),
                new TransitionDestinationInput(
                        TransitionDestinationOption.fromOptionIndex(destinationOptionIndex),
                        mapId,
                        tileId,
                        transitionId,
                        bidirectional,
                        true,
                        saveRequested),
                TransitionDescriptionInput.none(),
                StairGeometryInput.none());
    }

    static DungeonEditorStateInput stairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2,
            boolean saveRequested
    ) {
        return new DungeonEditorStateInput(
                NarrationInput.none(),
                LabelNameInput.none(),
                CorridorPointInput.none(),
                TransitionDestinationInput.none(),
                TransitionDescriptionInput.none(),
                new StairGeometryInput(
                        stairId,
                        StairShapeOption.fromExternalName(shapeName),
                        DirectionOption.fromExternalName(directionName),
                        dimension1,
                        dimension2,
                        true,
                        saveRequested));
    }

    record NarrationInput(
            long roomId,
            String visualDescription,
            List<String> exitDescriptions,
            boolean saveRequested
    ) {
        NarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = safeText(visualDescription);
            exitDescriptions = exitDescriptions == null
                    ? List.of()
                    : List.copyOf(exitDescriptions.stream().map(DungeonEditorStateInput::safeText).toList());
        }

        static NarrationInput none() {
            return new NarrationInput(0L, "", List.of(), false);
        }

    }

    record LabelNameInput(
            String name,
            boolean inputObserved,
            boolean saveRequested
    ) {
        LabelNameInput {
            name = safeText(name);
        }

        static LabelNameInput none() {
            return new LabelNameInput("", false, false);
        }

    }

    record CorridorPointInput(
            String q,
            String r,
            boolean inputObserved,
            boolean submitRequested
    ) {
        CorridorPointInput {
            q = safeText(q);
            r = safeText(r);
        }

        static CorridorPointInput none() {
            return new CorridorPointInput("", "", false, false);
        }

    }

    record TransitionDestinationInput(
            TransitionDestinationOption destination,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional,
            boolean inputObserved,
            boolean saveRequested
    ) {
        TransitionDestinationInput {
            destination = destination == null ? TransitionDestinationOption.UNLINKED_ENTRANCE : destination;
            mapId = safeText(mapId);
            tileId = safeText(tileId);
            transitionId = safeText(transitionId);
        }

        static TransitionDestinationInput none() {
            return new TransitionDestinationInput(
                    TransitionDestinationOption.UNLINKED_ENTRANCE,
                    "",
                    "",
                    "",
                    false,
                    false,
                    false);
        }

    }

    record TransitionDescriptionInput(
            long transitionId,
            String description,
            boolean inputObserved,
            boolean saveRequested
    ) {
        TransitionDescriptionInput {
            transitionId = Math.max(0L, transitionId);
            description = safeText(description);
        }

        static TransitionDescriptionInput none() {
            return new TransitionDescriptionInput(0L, "", false, false);
        }

    }

    record StairGeometryInput(
            long stairId,
            StairShapeOption shape,
            DirectionOption direction,
            String dimension1,
            String dimension2,
            boolean inputObserved,
            boolean saveRequested
    ) {
        StairGeometryInput {
            stairId = Math.max(0L, stairId);
            shape = shape == null ? StairShapeOption.none() : shape;
            direction = direction == null ? DirectionOption.none() : direction;
            dimension1 = safeText(dimension1);
            dimension2 = safeText(dimension2);
        }

        static StairGeometryInput none() {
            return new StairGeometryInput(
                    0L,
                    StairShapeOption.none(),
                    DirectionOption.none(),
                    "",
                    "",
                    false,
                    false);
        }

    }

    enum TransitionDestinationOption {
        UNLINKED_ENTRANCE(0),
        OVERWORLD_TILE(1),
        DUNGEON_MAP(2);

        private final int optionIndex;

        TransitionDestinationOption(int optionIndex) {
            this.optionIndex = optionIndex;
        }

        int optionIndex() {
            return optionIndex;
        }

        static TransitionDestinationOption fromOptionIndex(int optionIndex) {
            for (TransitionDestinationOption option : values()) {
                if (option.optionIndex == optionIndex) {
                    return option;
                }
            }
            return UNLINKED_ENTRANCE;
        }
    }

    enum StairShapeOption {
        NONE(""),
        STRAIGHT("STRAIGHT"),
        SQUARE("SQUARE"),
        CIRCULAR("CIRCULAR");

        private final String externalName;

        StairShapeOption(String externalName) {
            this.externalName = externalName;
        }

        String externalName() {
            return externalName;
        }

        static StairShapeOption none() {
            return NONE;
        }

        static StairShapeOption fromExternalName(String shapeName) {
            String normalized = normalizedName(shapeName);
            if (normalized.isBlank()) {
                return NONE;
            }
            for (StairShapeOption option : values()) {
                if (option.externalName.equals(normalized)) {
                    return option;
                }
            }
            return NONE;
        }
    }

    enum DirectionOption {
        NONE(""),
        NORTH("NORTH"),
        EAST("EAST"),
        SOUTH("SOUTH"),
        WEST("WEST");

        private final String externalName;

        DirectionOption(String externalName) {
            this.externalName = externalName;
        }

        String externalName() {
            return externalName;
        }

        static DirectionOption none() {
            return NONE;
        }

        static DirectionOption fromExternalName(String directionName) {
            String normalized = normalizedName(directionName);
            if (normalized.isBlank()) {
                return NONE;
            }
            for (DirectionOption option : values()) {
                if (option.externalName.equals(normalized)) {
                    return option;
                }
            }
            return NONE;
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }

    private static String normalizedName(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
    }
}
