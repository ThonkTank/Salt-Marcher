package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;

final class DungeonEditorRuntimeResultTranslator {
    private DungeonEditorRuntimeResultTranslator() {
    }

    static DungeonEditorRuntimeOperationResult fromSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        if (snapshot == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return DungeonEditorRuntimeSnapshotActions.fromSnapshot(snapshot);
    }

    static DungeonEditorRuntimeOperationResult fromPublication(
            ApplyDungeonEditorSessionEffectUseCase.PublicationResult publication
    ) {
        return fromPublication(null, publication);
    }

    static DungeonEditorRuntimeOperationResult fromOperationResult(
            DungeonAuthoredApplicationService.OperationResult result
    ) {
        return result == null || !result.present()
                ? DungeonEditorRuntimeOperationResult.none()
                : DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
    }

    static DungeonEditorRuntimeOperationResult fromPublication(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData fallbackSnapshot,
            ApplyDungeonEditorSessionEffectUseCase.PublicationResult publication
    ) {
        ApplyDungeonEditorSessionEffectUseCase.PublicationResult safePublication =
                Objects.requireNonNull(publication, "publication");
        return switch (safePublication.kind()) {
            case CONTROLS -> fromControls(safePublication.controls());
            case FULL_SNAPSHOT -> fromSnapshot(safePublication.snapshot());
            case NONE -> fromSnapshot(fallbackSnapshot);
        };
    }

    static DungeonEditorRuntimeOperationResult fromSessionFrame(
            DungeonEditorSessionSnapshot.@Nullable SessionFrameData frameData
    ) {
        if (frameData == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return fromControls(frameData.controlsData());
    }

    static DungeonEditorRuntimeOperationResult fromControls(
            DungeonEditorSessionSnapshot.@Nullable ControlsData controls
    ) {
        if (controls == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return DungeonEditorRuntimeControlActions.fromControls(controls);
    }
}
