package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SaveDungeonEditorLabelNameUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorLabelNameUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveLabelNameUseCase = Objects.requireNonNull(saveLabelNameUseCase, "saveLabelNameUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public DungeonEditorSessionSnapshot.@Nullable SnapshotData execute(LabelNameInput input) {
        LabelNameInput safeInput = input == null ? LabelNameInput.empty() : input;
        if (workflow.session().selectedMapId() != null) {
            saveLabelNameUseCase.execute(
                    workflow.session().selectedMapId(),
                    safeInput.targetKind(),
                    safeInput.targetId(),
                    safeInput.name());
        }
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        return effectUseCase.publishCurrent();
    }

    public record LabelNameInput(String targetKind, long targetId, String name) {
        public LabelNameInput {
            targetKind = targetKind == null ? "" : targetKind.trim();
            targetId = Math.max(0L, targetId);
            name = name == null ? "" : name.trim();
        }

        static LabelNameInput empty() {
            return new LabelNameInput("", 0L, "");
        }
    }
}
