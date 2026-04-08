package features.world.dungeon.runtime;

import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.runtime.input.RepairNavigationInput;

import java.sql.SQLException;
import java.util.Objects;

/**
 * Public root seam for dungeon runtime workflows.
 */
public final class RuntimeObject {

    private final DungeonRuntimeApplicationService runtimeApplicationService;

    public RuntimeObject(DungeonRuntimeApplicationService runtimeApplicationService) {
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
    }

    public void repairNavigation(RepairNavigationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        runtimeApplicationService.repairStoredRuntimeState(input.connection());
    }
}
