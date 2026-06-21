package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

final class DungeonEditorRuntimeInputValues {

    private DungeonEditorRuntimeInputValues() {
    }

    static DungeonEditorWorkspaceValues.Cell cell(double q, double r, int level) {
        return new DungeonEditorWorkspaceValues.Cell((int) Math.round(q), (int) Math.round(r), level);
    }

    static DungeonTopologyRef topologyRef(String kind, long id) {
        return new DungeonTopologyRef(DungeonEditorRuntimeEnumTranslator.topologyKind(kind), Math.max(0L, id));
    }
}
