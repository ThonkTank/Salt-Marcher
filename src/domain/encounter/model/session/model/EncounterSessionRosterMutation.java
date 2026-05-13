package src.domain.encounter.model.session.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.session.model.EncounterSessionValues.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterSessionValues.EncounterCreatureData;
import src.domain.encounter.model.session.model.EncounterSessionValues.RemovedRosterEntryData;

final class EncounterSessionRosterMutation {

    private static final int MAX_CREATURES_PER_SLOT = 20;
    private static final int MINIMUM_CREATURE_COUNT = 1;

    private final List<EncounterCreatureData> roster = new ArrayList<>();
    private Optional<RemovedRosterEntryData> pendingUndo = Optional.empty();
    private long nextUndoToken;

    boolean addCreature(CreatureDetailData creature, EncounterSessionContext context) {
        pendingUndo = Optional.empty();
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData existing = roster.get(index);
            if (existing.creatureId() == creature.id()) {
                roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
                return true;
            }
        }
        roster.add(EncounterSessionCreatureRows.manual(creature, MINIMUM_CREATURE_COUNT));
        context.setStatus(creature.name() + " wurde zum Encounter hinzugefuegt.");
        return true;
    }

    boolean incrementCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
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
            if (creature.creatureId() == creatureId) {
                return decrementRosterEntry(index, creature, context);
            }
        }
        return false;
    }

    boolean removeCreature(long creatureId, EncounterSessionContext context) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreatureData creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
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

    List<EncounterCreatureData> creatures() {
        return List.copyOf(roster);
    }

    boolean isEmpty() {
        return roster.isEmpty();
    }

    int totalXp() {
        return roster.stream().mapToInt(EncounterCreatureData::totalXp).sum();
    }

    Optional<RemovedRosterEntryData> pendingUndo() {
        return pendingUndo;
    }

    void clearPendingUndo() {
        pendingUndo = Optional.empty();
    }

    private boolean decrementRosterEntry(int index, EncounterCreatureData creature, EncounterSessionContext context) {
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
