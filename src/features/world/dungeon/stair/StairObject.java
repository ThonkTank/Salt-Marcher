package features.world.dungeon.stair;

import features.world.dungeon.stair.input.CreateStairInput;
import features.world.dungeon.stair.input.DeleteStairInput;
import features.world.dungeon.stair.input.LoadEditorSpecInput;
import features.world.dungeon.stair.input.MoveStairInput;
import features.world.dungeon.stair.input.UpdateStairInput;
import features.world.dungeon.stair.task.CreateStairTask;
import features.world.dungeon.stair.task.DeleteStairTask;
import features.world.dungeon.stair.task.LoadEditorSpecTask;
import features.world.dungeon.stair.task.MoveStairTask;
import features.world.dungeon.stair.task.UpdateStairTask;

import java.sql.SQLException;

/**
 * Public root seam for stair-owned workflows.
 */
public final class StairObject {

    public void deleteStair(DeleteStairInput input) throws SQLException {
        DeleteStairTask.deleteStair(input);
    }

    public long createStair(CreateStairInput input) throws SQLException {
        return CreateStairTask.createStair(input).stairId();
    }

    public void updateStair(UpdateStairInput input) throws SQLException {
        UpdateStairTask.updateStair(input);
    }

    public void moveStair(MoveStairInput input) throws SQLException {
        MoveStairTask.moveStair(input);
    }

    public LoadEditorSpecInput.EditorSpecInput loadEditorSpec(LoadEditorSpecInput input) throws SQLException {
        return LoadEditorSpecTask.loadEditorSpec(input);
    }
}
