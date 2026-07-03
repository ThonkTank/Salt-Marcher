package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class SetWorldNpcLifecycleStatusUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;

    public SetWorldNpcLifecycleStatusUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
    }

    public void execute(Request request) {
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        if (request == null || request.status() == null) {
            repository.save(state.withStatus("NPC Status nicht gefunden."));
            return;
        }
        WorldNpc npc = state.npc(request.npcId());
        if (npc == null) {
            repository.save(state.withStatus("NPC nicht gefunden."));
            return;
        }
        if (request.expectedCreatureStatblockId() > 0L
                && request.expectedCreatureStatblockId() != npc.creatureStatblockId()) {
            repository.save(state.withStatus("NPC passt nicht zum Encounter-Statblock."));
            return;
        }
        if (request.status().defeated()) {
            repository.save(WorldPlannerStateChanges.replaceNpc(state, npc.markDefeated(), "NPC besiegt markiert."));
            return;
        }
        repository.save(WorldPlannerStateChanges.replaceNpc(state, npc.reactivate(), "NPC reaktiviert."));
    }

    public record Request(long npcId, LifecycleStatus status, long expectedCreatureStatblockId) {
        public Request {
            npcId = Math.max(0L, npcId);
            expectedCreatureStatblockId = Math.max(0L, expectedCreatureStatblockId);
        }
    }

    public enum LifecycleStatus {
        ACTIVE(false),
        DEFEATED(true);

        private final boolean defeated;

        LifecycleStatus(boolean defeated) {
            this.defeated = defeated;
        }

        boolean defeated() {
            return defeated;
        }
    }
}
