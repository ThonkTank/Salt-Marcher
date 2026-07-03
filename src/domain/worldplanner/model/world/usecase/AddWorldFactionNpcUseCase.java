package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class AddWorldFactionNpcUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;

    public AddWorldFactionNpcUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
    }

    public void execute(long factionId, long npcId) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldFaction faction = state.faction(factionId);
        if (faction == null || state.npc(npcId) == null) {
            repository.save(state.withStatus("Fraktion oder NPC nicht gefunden."));
            return;
        }
        if (faction.npcIds().contains(npcId)) {
            repository.save(state.withStatus("NPC ist bereits Teil der Fraktion."));
            return;
        }
        repository.save(WorldPlannerStateChanges.replaceFaction(
                state,
                faction.addNpc(npcId),
                "NPC zur Fraktion hinzugefuegt."));
    }
}
