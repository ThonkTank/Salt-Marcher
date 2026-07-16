package src.domain.encounter.published;

import java.util.List;

/** Scene-neutral boundary for selecting and reconciling encounter runtime contexts. */
public interface EncounterRuntimeContextApi {

    SyncResult synchronize(SynchronizeEncounterContextsCommand command);

    record SynchronizeEncounterContextsCommand(
            long revision,
            String focusedContextKey,
            List<Context> contexts
    ) {
        public SynchronizeEncounterContextsCommand {
            focusedContextKey = focusedContextKey == null ? "" : focusedContextKey;
            contexts = contexts == null ? List.of() : List.copyOf(contexts);
        }
    }

    record Context(
            String key,
            List<Long> partyMemberIds,
            long worldLocationId,
            long initialEncounterPlanId,
            List<Npc> npcs
    ) {
        public Context {
            key = key == null ? "" : key;
            partyMemberIds = partyMemberIds == null ? List.of() : List.copyOf(partyMemberIds);
            worldLocationId = Math.max(0L, worldLocationId);
            initialEncounterPlanId = Math.max(0L, initialEncounterPlanId);
            npcs = npcs == null ? List.of() : List.copyOf(npcs);
        }
    }

    record Npc(long worldNpcId, long creatureId, Role role, boolean active) {
        public Npc {
            role = role == null ? Role.NEUTRAL : role;
        }
    }

    enum Role { HOSTILE, NEUTRAL, FRIENDLY }
    record SyncResult(boolean success, String message) {
        public SyncResult { message = message == null ? "" : message; }
    }
}
