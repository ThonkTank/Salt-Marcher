package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;

public interface ApplyDungeonEditorSessionUseCase {
    void apply(DungeonEditorSessionCommand command);
}
