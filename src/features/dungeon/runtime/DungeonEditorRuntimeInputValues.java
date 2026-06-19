package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.CellInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyRefInput;

final class DungeonEditorRuntimeInputValues {

    private DungeonEditorRuntimeInputValues() {
    }

    static CellInput cellInput(double q, double r, int level) {
        return new CellInput((int) Math.round(q), (int) Math.round(r), level);
    }

    static TopologyRefInput topologyRef(String kind, long id) {
        return new TopologyRefInput(DungeonEditorRuntimeEnumTranslator.topologyKind(kind), id);
    }
}
