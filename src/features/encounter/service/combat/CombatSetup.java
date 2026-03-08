package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.creaturecatalog.model.Creature;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.MonsterCombatant;
import features.encounter.model.PcCombatant;
import features.party.model.PlayerCharacter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.random.RandomGenerator;

import features.encounter.service.EncounterCreatureMapper;
import features.encounter.service.generation.EncounterScoring;
import features.gamerules.service.XpCalculator;

public final class CombatSetup {
    private CombatSetup() {
        throw new AssertionError("No instances");
    }

    public enum BuildCombatantsStatus { SUCCESS, INVALID_INPUT }

    public enum BuildCombatantsFailureReason {
        PARTY_MISSING,
        PC_INITIATIVES_MISSING,
        SLOTS_MISSING,
        SLOTS_INVALID,
        PARTY_MEMBER_MISSING,
        PC_INITIATIVE_VALUE_MISSING,
        PC_INITIATIVE_COUNT_MISMATCH
    }

    public record BuildCombatantsResult(
            BuildCombatantsStatus status,
            List<Combatant> combatants,
            BuildCombatantsFailureReason failureReason
    ) {
        public static BuildCombatantsResult success(List<Combatant> combatants) {
            return new BuildCombatantsResult(BuildCombatantsStatus.SUCCESS, combatants, null);
        }

        public static BuildCombatantsResult invalidInput(BuildCombatantsFailureReason failureReason) {
            return new BuildCombatantsResult(BuildCombatantsStatus.INVALID_INPUT, List.of(), failureReason);
        }
    }

    /**
     * Builds the full combatant list for a combat encounter.
     * Monsters are always instantiated individually; mob turns are derived later as a runtime
     * projection in CombatTrackerPane from Creature-ID + initiative.
     *
     * @param monsterInitiatives list of pre-rolled initiatives, one value per encounter slot
     *                           in slot-iteration order (same order as shown in InitiativePane).
     *                           Every creature in the same slot receives the same initiative.
     *                           Pass null to auto-roll every slot.
     */
    public static BuildCombatantsResult buildCombatants(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            List<PreparedEncounterSlot> preparedSlots,
            List<Integer> monsterInitiatives) {
        return buildCombatants(party, pcInitiatives, preparedSlots, monsterInitiatives, ThreadLocalRandom.current());
    }

    static BuildCombatantsResult buildCombatants(
            List<PlayerCharacter> party,
            List<Integer> pcInitiatives,
            List<PreparedEncounterSlot> preparedSlots,
            List<Integer> monsterInitiatives,
            RandomGenerator random) {
        Objects.requireNonNull(random, "random");
        if (party == null) {
            return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.PARTY_MISSING);
        }
        if (pcInitiatives == null) {
            return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.PC_INITIATIVES_MISSING);
        }
        if (preparedSlots == null) {
            return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.SLOTS_MISSING);
        }
        if (preparedSlots.isEmpty()) {
            return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.SLOTS_INVALID);
        }
        if (pcInitiatives.size() != party.size()) {
            return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.PC_INITIATIVE_COUNT_MISMATCH);
        }
        for (PlayerCharacter pc : party) {
            if (pc == null) {
                return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.PARTY_MEMBER_MISSING);
            }
        }
        for (Integer initiative : pcInitiatives) {
            if (initiative == null) {
                return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.PC_INITIATIVE_VALUE_MISSING);
            }
        }
        for (PreparedEncounterSlot slot : preparedSlots) {
            if (slot == null || slot.creature() == null) {
                return BuildCombatantsResult.invalidInput(BuildCombatantsFailureReason.SLOTS_INVALID);
            }
        }

        List<Combatant> combatants = new ArrayList<>();

        // PCs with manually entered initiative.
        for (int i = 0; i < party.size(); i++) {
            PlayerCharacter pc = party.get(i);
            PcCombatant cs     = new PcCombatant();
            cs.rename(pc.Name + " (Lv." + pc.Level + ")");
            cs.setInitiative(pcInitiatives.get(i));
            combatants.add(cs);
        }

        // Monsters are always individual combatants. Runtime mob grouping is handled by CombatTrackerPane.
        int slotIdx = 0;
        for (PreparedEncounterSlot slot : preparedSlots) {
            Integer monsterInitiative = (monsterInitiatives != null && slotIdx < monsterInitiatives.size())
                    ? monsterInitiatives.get(slotIdx)
                    : InitiativeRoller.rollFor(slot.creature());
            int initiative = monsterInitiative != null
                    ? monsterInitiative
                    : InitiativeRoller.rollFor(slot.creature());
            slotIdx++;
            for (int i = 1; i <= slot.count(); i++) {
                MonsterCombatant mc = MonsterCombatantFactory.createFromSlot(slot, i, initiative, random);
                combatants.add(mc);
            }
        }

        // Sort by initiative; PCs win ties.
        combatants.sort(CombatOrdering.BY_INITIATIVE_PC_FIRST);

        return BuildCombatantsResult.success(combatants);
    }

    /** Compute difficulty stats from alive monster combatants. */
    public static XpCalculator.DifficultyStats computeLiveStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return XpCalculator.computeStats(
                EncounterScoring.adjustedXpFromCombatants(combatants),
                partySize,
                avgLevel
        );
    }

    /**
     * Returns a unique display name for a creature being added to an existing combatant list.
     * Appends " #N" when another combatant of the same creature already exists.
     */
    public static String uniqueNameFor(Creature creature, List<Combatant> combatants) {
        EncounterCreatureSnapshot snapshot = EncounterCreatureMapper.toSnapshot(creature);
        return uniqueNameFor(snapshot, combatants);
    }

    public static String uniqueNameFor(EncounterCreatureSnapshot creature, List<Combatant> combatants) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        long count = combatants.stream()
                .filter(c -> c instanceof MonsterCombatant mc && mc.getCreatureRef() != null
                        && mc.getCreatureRef().getId().equals(creature.getId()))
                .count();
        return count > 0 ? creature.getName() + " #" + (count + 1) : creature.getName();
    }

    /**
     * Creates a single reinforcement combatant with auto-rolled initiative.
     * @param creature the creature to add
     * @return a new MonsterCombatant ready to insert into the turn order
     */
    public static MonsterCombatant createReinforcement(Creature creature) {
        return createReinforcement(EncounterCreatureMapper.toSnapshot(creature));
    }

    public static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature) {
        return MonsterCombatantFactory.createReinforcement(creature);
    }
}
