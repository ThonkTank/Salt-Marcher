package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldNpcLifecycleState;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class CreateWorldNpcUseCase {
    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final WorldPlannerReferencePort referenceValidator;

    public CreateWorldNpcUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    public void execute(Request request) {
        Request safeRequest = request == null ? Request.empty() : request;
        execute(
                safeRequest.displayName(),
                safeRequest.creatureStatblockId(),
                safeRequest.appearanceNotes(),
                safeRequest.behaviorNotes(),
                safeRequest.historyNotes(),
                safeRequest.generalNotes());
    }

    private void execute(
            String displayName,
            long creatureStatblockId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        if (!WorldPlannerIds.isPositive(creatureStatblockId)
                || !referenceValidator.creatureStatblockExists(creatureStatblockId)) {
            repository.save(state.withStatus("Creature Statblock nicht gefunden."));
            return;
        }
        WorldNpc.Notes notes = new WorldNpc.Notes(appearanceNotes, behaviorNotes, historyNotes, generalNotes);
        WorldNpc npc = new WorldNpc(
                state.nextNpcId(),
                displayName,
                creatureStatblockId,
                notes.appearanceNotes(),
                notes.behaviorNotes(),
                notes.historyNotes(),
                notes.generalNotes(),
                WorldNpcLifecycleState.ACTIVE);
        repository.save(new WorldPlannerState(
                WorldPlannerStateChanges.append(state.npcs(), npc),
                state.factions(),
                state.locations(),
                state.nextNpcId() + 1L,
                state.nextFactionId(),
                state.nextLocationId(),
                "NPC erstellt."));
    }

    public record Request(
            String displayName,
            long creatureStatblockId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {
        private static Request empty() {
            return new Request("", 0L, "", "", "", "");
        }
    }
}
