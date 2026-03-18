package features.world.dungeonmap.editor.edit.application;

import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;

public sealed interface DungeonEditorEditPlan permits
        DungeonEditorEditPlan.Execute,
        DungeonEditorEditPlan.SelectCorridorTarget,
        DungeonEditorEditPlan.NoOp {

    record Execute(DungeonEditorEditCommand command) implements DungeonEditorEditPlan {
    }

    record SelectCorridorTarget(DungeonCorridorEndpoint target) implements DungeonEditorEditPlan {
    }

    record NoOp() implements DungeonEditorEditPlan {
    }
}
