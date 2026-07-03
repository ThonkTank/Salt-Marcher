package src.domain.worldplanner.model.world.usecase;

import java.util.Objects;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class UpdateWorldNpcNotesUseCase {

    private final WorldPlannerRepository repository;
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;

    public UpdateWorldNpcNotesUseCase(
            WorldPlannerRepository repository,
            LoadWorldPlannerUseCase loadWorldPlannerUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadWorldPlannerUseCase = Objects.requireNonNull(loadWorldPlannerUseCase, "loadWorldPlannerUseCase");
    }

    public void execute(Request request) {
        Request safeRequest = request == null ? Request.empty() : request;
        execute(
                safeRequest.npcId(),
                safeRequest.appearanceNotes(),
                safeRequest.behaviorNotes(),
                safeRequest.historyNotes(),
                safeRequest.generalNotes());
    }

    private void execute(
            long npcId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {
        WorldNpc.Notes safeNotes = new WorldNpc.Notes(appearanceNotes, behaviorNotes, historyNotes, generalNotes);
        WorldPlannerState state = loadWorldPlannerUseCase.execute();
        WorldNpc npc = state.npc(npcId);
        if (npc == null) {
            repository.save(state.withStatus("NPC nicht gefunden."));
            return;
        }
        repository.save(WorldPlannerStateChanges.replaceNpc(
                state,
                npc.updateNotes(safeNotes),
                "NPC-Notizen aktualisiert."));
    }

    public record Request(
            long npcId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {
        private static Request empty() {
            return new Request(0L, "", "", "", "");
        }
    }
}
