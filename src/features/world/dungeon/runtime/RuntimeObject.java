package features.world.dungeon.runtime;

import features.world.dungeon.runtime.input.LoadNavigationInput;
import features.world.dungeon.runtime.input.NavigateInput;
import features.world.dungeon.runtime.input.NavigateToCellInput;
import features.world.dungeon.runtime.input.RepairNavigationInput;
import features.world.dungeon.runtime.input.ResolveNavigationInput;
import features.world.dungeon.runtime.input.ResolveRepairNavigationInput;
import features.world.dungeon.runtime.task.LoadNavigationTask;
import features.world.dungeon.runtime.task.NavigateTask;
import features.world.dungeon.runtime.task.NavigateToCellTask;
import features.world.dungeon.runtime.task.RepairNavigationTask;
import features.world.dungeon.runtime.task.ResolveNavigationTask;
import features.world.dungeon.runtime.task.ResolveRepairNavigationTask;

import java.sql.SQLException;

/**
 * Public root seam for dungeon runtime workflows.
 */
public final class RuntimeObject {

    public void repairNavigation(RepairNavigationInput input) throws SQLException {
        RepairNavigationTask.repairNavigation(input);
    }

    public ResolveRepairNavigationInput.NavigationInput resolveRepairNavigation(
            ResolveRepairNavigationInput input
    ) throws SQLException {
        return ResolveRepairNavigationTask.resolveRepairNavigation(input);
    }

    public LoadNavigationInput.NavigationInput loadNavigation(LoadNavigationInput input) throws SQLException {
        return LoadNavigationTask.loadNavigation(input);
    }

    public ResolveNavigationInput.NavigationInput resolveNavigation(
            ResolveNavigationInput input
    ) throws SQLException {
        return ResolveNavigationTask.resolveNavigation(input);
    }

    public NavigateToCellInput.NavigationInput navigateToCell(
            NavigateToCellInput input
    ) throws SQLException {
        return NavigateToCellTask.navigateToCell(input);
    }

    public NavigateInput.NavigationInput navigate(
            NavigateInput input
    ) throws SQLException {
        return NavigateTask.navigate(input);
    }
}
