package features.world.dungeon.transition;

import features.world.dungeon.transition.input.CreateStairTransitionInput;
import features.world.dungeon.transition.input.CreateTransitionInput;
import features.world.dungeon.transition.input.DeleteTransitionInput;
import features.world.dungeon.transition.input.LoadDungeonTargetsInput;
import features.world.dungeon.transition.input.LoadOverworldTargetsInput;
import features.world.dungeon.transition.input.PlacePreparedStairTransitionInput;
import features.world.dungeon.transition.input.PlacePreparedTransitionInput;
import features.world.dungeon.transition.input.PersistReboundConnectionsInput;
import features.world.dungeon.transition.task.CreateStairTransitionTask;
import features.world.dungeon.transition.task.CreateTransitionTask;
import features.world.dungeon.transition.task.DeleteTransitionTask;
import features.world.dungeon.transition.task.LoadDungeonTargetsTask;
import features.world.dungeon.transition.task.LoadOverworldTargetsTask;
import features.world.dungeon.transition.task.PlacePreparedStairTransitionTask;
import features.world.dungeon.transition.task.PlacePreparedTransitionTask;
import features.world.dungeon.transition.task.PersistReboundConnectionsTask;

import java.sql.SQLException;
import java.util.List;

/**
 * Public root owner object for persisted dungeon-transition placement updates.
 */
public final class TransitionObject {

    public List<LoadDungeonTargetsInput.TargetInput> loadDungeonTargets(
            LoadDungeonTargetsInput input
    ) throws SQLException {
        return LoadDungeonTargetsTask.loadDungeonTargets(input);
    }

    public List<LoadOverworldTargetsInput.TargetInput> loadOverworldTargets(
            LoadOverworldTargetsInput input
    ) throws SQLException {
        return LoadOverworldTargetsTask.loadOverworldTargets(input);
    }

    public void createTransition(CreateTransitionInput input) throws SQLException {
        CreateTransitionTask.createTransition(input);
    }

    public void createStairTransition(CreateStairTransitionInput input) throws SQLException {
        CreateStairTransitionTask.createStairTransition(input);
    }

    public void deleteTransition(DeleteTransitionInput input) throws SQLException {
        DeleteTransitionTask.deleteTransition(input);
    }

    public void placePreparedTransition(PlacePreparedTransitionInput input) throws SQLException {
        PlacePreparedTransitionTask.placePreparedTransition(input);
    }

    public void placePreparedStairTransition(PlacePreparedStairTransitionInput input) throws SQLException {
        PlacePreparedStairTransitionTask.placePreparedStairTransition(input);
    }

    /**
     * Persist map-owned rebound results through the transition owner seam while preserving any existing stair
     * placement spec attached to the original transition.
     */
    public void persistReboundConnections(PersistReboundConnectionsInput input) throws SQLException {
        PersistReboundConnectionsTask.persistReboundConnections(input);
    }
}
