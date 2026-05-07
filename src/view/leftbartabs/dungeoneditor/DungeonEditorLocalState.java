package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;

record DungeonEditorLocalState(
        DungeonEditorMapEditorUiState mapEditorUiState,
        DungeonEditorToolPaletteUiState toolPaletteUiState
) {
    DungeonEditorLocalState {
        mapEditorUiState = mapEditorUiState == null ? DungeonEditorMapEditorUiState.hidden() : mapEditorUiState;
        toolPaletteUiState = toolPaletteUiState == null ? DungeonEditorToolPaletteUiState.closed() : toolPaletteUiState;
    }

    static DungeonEditorLocalState initial() {
        return new DungeonEditorLocalState(DungeonEditorMapEditorUiState.hidden(), DungeonEditorToolPaletteUiState.closed());
    }

    DungeonEditorLocalState withMapEditorUiState(DungeonEditorMapEditorUiState nextMapEditorUiState) {
        return new DungeonEditorLocalState(nextMapEditorUiState, toolPaletteUiState);
    }

    DungeonEditorLocalState withToolPaletteUiState(DungeonEditorToolPaletteUiState nextToolPaletteUiState) {
        return new DungeonEditorLocalState(mapEditorUiState, nextToolPaletteUiState);
    }
}

sealed interface DungeonEditorLocalMutation permits OpenCreateMapEditorMutation,
        OpenSelectedMapEditorMutation,
        UpdateMapEditorDraftMutation,
        ShowMapEditorValidationErrorMutation,
        CloseMapEditorMutation,
        SetToolPaletteMutation {
}

record OpenCreateMapEditorMutation() implements DungeonEditorLocalMutation {
}

record OpenSelectedMapEditorMutation(
        DungeonEditorMapEditorMode mode,
        long mapIdValue
) implements DungeonEditorLocalMutation {
    OpenSelectedMapEditorMutation {
        mode = mode == null ? DungeonEditorMapEditorMode.HIDDEN : mode;
        mapIdValue = Math.max(DungeonEditorInteractionState.NO_MAP_ID, mapIdValue);
    }
}

record UpdateMapEditorDraftMutation(String draftName) implements DungeonEditorLocalMutation {
    UpdateMapEditorDraftMutation {
        draftName = draftName == null ? "" : draftName;
    }
}

record ShowMapEditorValidationErrorMutation(String errorText) implements DungeonEditorLocalMutation {
    ShowMapEditorValidationErrorMutation {
        errorText = errorText == null ? "" : errorText;
    }
}

record CloseMapEditorMutation() implements DungeonEditorLocalMutation {
}

record SetToolPaletteMutation(@Nullable DungeonEditorToolFamily family) implements DungeonEditorLocalMutation {
}

final class DungeonEditorLocalStateReducer {

    private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

    private DungeonEditorLocalStateReducer() {
    }

    static DungeonEditorLocalState apply(
            DungeonEditorLocalState localState,
            DungeonEditorInteractionState interactionState,
            DungeonEditorLocalMutation mutation
    ) {
        DungeonEditorLocalState safeLocalState = localState == null ? DungeonEditorLocalState.initial() : localState;
        DungeonEditorInteractionState safeInteractionState =
                interactionState == null ? DungeonEditorInteractionState.empty() : interactionState;
        return switch (mutation) {
            case OpenCreateMapEditorMutation ignored -> safeLocalState.withMapEditorUiState(
                    DungeonEditorMapEditorUiState.create(DEFAULT_DUNGEON_NAME));
            case OpenSelectedMapEditorMutation open -> applyOpenSelectedMapEditor(safeLocalState, safeInteractionState, open);
            case UpdateMapEditorDraftMutation update -> applyDraftUpdate(safeLocalState, update);
            case ShowMapEditorValidationErrorMutation validationError -> applyValidationError(safeLocalState, validationError);
            case CloseMapEditorMutation ignored -> safeLocalState.withMapEditorUiState(DungeonEditorMapEditorUiState.hidden());
            case SetToolPaletteMutation palette -> safeLocalState.withToolPaletteUiState(
                    palette.family() == null
                            ? DungeonEditorToolPaletteUiState.closed()
                            : DungeonEditorToolPaletteUiState.open(palette.family()));
        };
    }

    private static DungeonEditorLocalState applyOpenSelectedMapEditor(
            DungeonEditorLocalState localState,
            DungeonEditorInteractionState interactionState,
            OpenSelectedMapEditorMutation mutation
    ) {
        DungeonEditorMapListEntry mapEntry = interactionState.mapEntry(mutation.mapIdValue());
        if (mapEntry == null) {
            return localState.withMapEditorUiState(DungeonEditorMapEditorUiState.hidden());
        }
        if (mutation.mode() == DungeonEditorMapEditorMode.RENAME) {
            return localState.withMapEditorUiState(
                    DungeonEditorMapEditorUiState.rename(mapEntry.mapIdValue(), mapEntry.mapName()));
        }
        if (mutation.mode() == DungeonEditorMapEditorMode.DELETE) {
            return localState.withMapEditorUiState(
                    DungeonEditorMapEditorUiState.delete(mapEntry.mapIdValue(), mapEntry.mapName()));
        }
        return localState;
    }

    private static DungeonEditorLocalState applyDraftUpdate(
            DungeonEditorLocalState localState,
            UpdateMapEditorDraftMutation mutation
    ) {
        DungeonEditorMapEditorUiState currentState = localState.mapEditorUiState();
        if (!currentState.visible()) {
            return localState;
        }
        String safeDraftName = mutation.draftName().strip();
        if (currentState.draftName().equals(safeDraftName) && currentState.errorText().isBlank()) {
            return localState;
        }
        return localState.withMapEditorUiState(currentState.withDraftName(safeDraftName).withErrorText(""));
    }

    private static DungeonEditorLocalState applyValidationError(
            DungeonEditorLocalState localState,
            ShowMapEditorValidationErrorMutation mutation
    ) {
        DungeonEditorMapEditorUiState currentState = localState.mapEditorUiState();
        if (!currentState.visible()) {
            return localState;
        }
        return localState.withMapEditorUiState(currentState.withErrorText(mutation.errorText()));
    }
}
