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

    static DungeonEditorStateInput fromLegacy(DungeonEditorStateViewInputEvent event) {
        DungeonEditorStateViewInputEvent safeEvent = event == null
                ? new DungeonEditorStateViewInputEvent(
                        0L,
                        "",
                        List.of(),
                        false,
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
                        false)
                : event;
        return new DungeonEditorStateInput(
                NarrationInput.fromLegacy(safeEvent),
                LabelNameInput.fromLegacy(safeEvent),
                CorridorPointInput.fromLegacy(safeEvent),
                TransitionDestinationInput.fromLegacy(safeEvent),
                TransitionDescriptionInput.fromLegacy(safeEvent),
                StairGeometryInput.fromLegacy(safeEvent));
    }

    DungeonEditorStateViewInputEvent toLegacyEvent() {
        return new DungeonEditorStateViewInputEvent(
                narration.roomId(),
                narration.visualDescription(),
                narration.exitDescriptions(),
                narration.saveRequested(),
                labelName.name(),
                labelName.inputObserved(),
                labelName.saveRequested(),
                corridorPoint.q(),
                corridorPoint.r(),
                corridorPoint.inputObserved(),
                corridorPoint.submitRequested(),
                transitionDescription.transitionId(),
                transitionDescription.description(),
                transitionDescription.inputObserved(),
                transitionDescription.saveRequested(),
                transitionDestination.destination().legacyOptionIndex(),
                transitionDestination.mapId(),
                transitionDestination.tileId(),
                transitionDestination.transitionId(),
                transitionDestination.bidirectional(),
                transitionDestination.inputObserved(),
                transitionDestination.saveRequested(),
                stairGeometry.stairId(),
                stairGeometry.shape().externalName(),
                stairGeometry.direction().externalName(),
                stairGeometry.dimension1(),
                stairGeometry.dimension2(),
                stairGeometry.inputObserved(),
                stairGeometry.saveRequested());
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

        static NarrationInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new NarrationInput(
                    event.roomId(),
                    event.visualDescription(),
                    event.exitDescriptions(),
                    event.narrationSaveRequested());
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

        static LabelNameInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new LabelNameInput(
                    event.labelName(),
                    event.labelNameInputObserved(),
                    event.labelNameSaveRequested());
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

        static CorridorPointInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new CorridorPointInput(
                    event.corridorPointQ(),
                    event.corridorPointR(),
                    event.corridorPointInputObserved(),
                    event.corridorPointSubmitRequested());
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

        static TransitionDestinationInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new TransitionDestinationInput(
                    TransitionDestinationOption.fromLegacyOptionIndex(
                            event.transitionDestinationTypeOptionIndex()),
                    event.transitionDestinationMapId(),
                    event.transitionDestinationTileId(),
                    event.transitionDestinationTransitionId(),
                    event.transitionDestinationBidirectional(),
                    event.transitionDestinationInputObserved(),
                    event.transitionDestinationSaveRequested());
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

        static TransitionDescriptionInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new TransitionDescriptionInput(
                    event.transitionId(),
                    event.transitionDescription(),
                    event.transitionDescriptionInputObserved(),
                    event.transitionDescriptionSaveRequested());
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

        static StairGeometryInput fromLegacy(DungeonEditorStateViewInputEvent event) {
            return new StairGeometryInput(
                    event.stairId(),
                    StairShapeOption.fromExternalName(event.stairShapeName()),
                    DirectionOption.fromExternalName(event.stairDirectionName()),
                    event.stairDimension1(),
                    event.stairDimension2(),
                    event.stairGeometryInputObserved(),
                    event.stairGeometrySaveRequested());
        }
    }

    enum TransitionDestinationOption {
        UNLINKED_ENTRANCE(0),
        OVERWORLD_TILE(1),
        DUNGEON_MAP(2);

        private final int legacyOptionIndex;

        TransitionDestinationOption(int legacyOptionIndex) {
            this.legacyOptionIndex = legacyOptionIndex;
        }

        int legacyOptionIndex() {
            return legacyOptionIndex;
        }

        static TransitionDestinationOption fromLegacyOptionIndex(int optionIndex) {
            for (TransitionDestinationOption option : values()) {
                if (option.legacyOptionIndex == optionIndex) {
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
