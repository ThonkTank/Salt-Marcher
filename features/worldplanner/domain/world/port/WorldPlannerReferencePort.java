package features.worldplanner.domain.world.port;

public interface WorldPlannerReferencePort {

    boolean creatureStatblockExists(long creatureStatblockId);

    boolean encounterTableExists(long encounterTableId);
}
