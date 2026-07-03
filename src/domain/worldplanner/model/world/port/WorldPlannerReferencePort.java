package src.domain.worldplanner.model.world.port;

public interface WorldPlannerReferencePort {

    boolean creatureStatblockExists(long creatureStatblockId);

    boolean encounterTableExists(long encounterTableId);
}
