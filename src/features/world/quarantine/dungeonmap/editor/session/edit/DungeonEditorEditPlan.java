package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;

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
