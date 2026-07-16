package features.worldplanner.api;

@FunctionalInterface
public interface WorldPlannerEncounterSink {

    void addNpc(long statblockId, long npcId);
}
