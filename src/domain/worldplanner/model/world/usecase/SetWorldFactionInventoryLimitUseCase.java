package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldFactionInventoryLimit;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class SetWorldFactionInventoryLimitUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final WorldPlannerReferencePort referenceValidator;

    public SetWorldFactionInventoryLimitUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    public void execute(long factionId, long creatureStatblockId, boolean finite, int quantity) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldFaction faction = state.faction(factionId);
        if (faction == null
                || !WorldPlannerIds.isPositive(creatureStatblockId)
                || !referenceValidator.creatureStatblockExists(creatureStatblockId)) {
            repository.save(state.withStatus("Fraktion oder Creature Statblock nicht gefunden."));
            return;
        }
        if (finite && quantity < 0) {
            repository.save(state.withStatus("Fraktionsbestand ungueltig."));
            return;
        }
        WorldFactionInventoryLimit limit = new WorldFactionInventoryLimit(creatureStatblockId, finite, quantity);
        repository.save(WorldPlannerStateChanges.replaceFaction(
                state,
                faction.setInventoryLimit(limit),
                "Fraktionsbestand aktualisiert."));
    }
}
