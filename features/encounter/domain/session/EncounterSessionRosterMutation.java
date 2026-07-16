package features.encounter.domain.session;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

final class EncounterSessionRosterMutation {

    private static final int MAX_CREATURES_PER_SLOT = 20;
    private static final int MINIMUM_CREATURE_COUNT = 1;
    private static final long UNRESOLVED_WORLD_NPC_ID = 0L;

    private final List<EncounterCreatureData> roster = new ArrayList<>();
    private Optional<RemovedRosterEntryData> pendingUndo = Optional.empty();
    private long nextUndoToken;

    boolean addCreature(CreatureDetailData creature, long worldNpcId, EncounterSessionContext context) {
        pendingUndo = Optional.empty();
        if (worldNpcId <= UNRESOLVED_WORLD_NPC_ID) {
            for (int index = 0; index < roster.size(); index++) {
                EncounterCreatureData existing = roster.get(index);
                if (existing.creatureId() == creature.id() && existing.worldNpcId() == UNRESOLVED_WORLD_NPC_ID) {
                    roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                    context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
                    return true;
                }
            }
        }
        roster.add(worldNpcId > UNRESOLVED_WORLD_NPC_ID
                ? EncounterSessionCreatureRows.worldNpc(creature, worldNpcId)
                : EncounterSessionCreatureRows.manual(creature, MINIMUM_CREATURE_COUNT));
        context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
        return true;
    }

    boolean incrementCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (isGenericCreature(creature, creatureId)) {
                pendingUndo = Optional.empty();
                roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                context.setStatus(creature.name() + " Anzahl angepasst.");
                return true;
            }
        }
        return false;
    }

    boolean decrementCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (isGenericCreature(creature, creatureId)) {
                if (creature.count() == MINIMUM_CREATURE_COUNT) {
                    context.setStatus(creature.name() + " bleibt mindestens einmal im Roster.");
                    return false;
                }
                pendingUndo = Optional.empty();
                roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
                context.setStatus(creature.name() + " Anzahl angepasst.");
                return true;
            }
        }
        return false;
    }

    boolean mutateCreature(EncounterSessionCommand command, EncounterSessionContext context) {
        return switch (command.action()) {
            case INCREMENT_CREATURE -> incrementCreature(command.creatureId(), context);
            case DECREMENT_CREATURE -> decrementCreature(command.creatureId(), context);
            case REMOVE_CREATURE -> removeCreature(command.creatureId(), context);
            case UNDO_REMOVE -> undoRemove(command.token(), context);
            default -> false;
        };
    }

    boolean removeCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (isGenericCreature(creature, creatureId)) {
                roster.remove(index);
                nextUndoToken++;
                pendingUndo = Optional.of(new RemovedRosterEntryData(nextUndoToken, index, creature));
                context.setStatus(creature.name() + " wurde entfernt.");
                return true;
            }
        }
        return false;
    }

    boolean undoRemove(long token, EncounterSessionContext context) {
        if (pendingUndo.isEmpty() || pendingUndo.orElseThrow().token() != token) {
            return false;
        }
        RemovedRosterEntryData removed = pendingUndo.orElseThrow();
        int index = Math.max(0, Math.min(removed.index(), roster.size()));
        roster.add(index, removed.creature());
        pendingUndo = Optional.empty();
        context.setStatus(removed.creature().name() + " wurde wiederhergestellt.");
        return true;
    }

    void replaceWithGenerated(List<EncounterCreatureData> generatedRoster) {
        roster.clear();
        roster.addAll(generatedRoster);
        pendingUndo = Optional.empty();
    }

    EncounterSessionRosterState snapshot() {
        return new EncounterSessionRosterState(roster, pendingUndo);
    }

    void clearPendingUndo() {
        pendingUndo = Optional.empty();
    }

    private static boolean isGenericCreature(EncounterCreatureData creature, long creatureId) {
        return creature.creatureId() == creatureId && creature.worldNpcId() == UNRESOLVED_WORLD_NPC_ID;
    }
}
