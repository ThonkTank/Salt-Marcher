package features.encounter.combat.application;

import features.encounter.combat.model.Combatant;
import features.encounter.combat.model.MonsterCombatant;
import features.encounter.combat.model.PreparedEncounterSlot;
import features.encounter.combat.service.CombatOutcomeService;
import features.encounter.combat.service.CombatSession;
import features.encounter.combat.service.CombatSetup;
import features.encounter.combat.service.EncounterLootService;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.party.api.PartyApi;
import shared.rules.service.XpCalculator;

import java.util.List;
import java.util.Set;

public final class EncounterCombatService {

    public record CombatStartRequest(
            List<PartyApi.PartyMember> party,
            List<Integer> pcInitiatives,
            Encounter encounter,
            List<Integer> monsterInitiatives
    ) {}

    public enum CombatStartStatus { SUCCESS, INVALID_INPUT }

    public enum CombatStartFailureReason {
        REQUEST_MISSING,
        PARTY_MISSING,
        PC_INITIATIVES_MISSING,
        ENCOUNTER_MISSING,
        ENCOUNTER_SLOTS_INVALID,
        PARTY_MEMBER_MISSING,
        PC_INITIATIVE_VALUE_MISSING,
        PC_INITIATIVE_COUNT_MISMATCH
    }

    public record CombatStartResult(
            CombatStartStatus status,
            List<Combatant> combatants,
            CombatStartFailureReason failureReason
    ) {
        public static CombatStartResult success(List<Combatant> combatants) {
            return new CombatStartResult(CombatStartStatus.SUCCESS, combatants, null);
        }

        public static CombatStartResult invalidInput(CombatStartFailureReason failureReason) {
            return new CombatStartResult(CombatStartStatus.INVALID_INPUT, List.of(), failureReason);
        }
    }

    public CombatStartResult prepareCombatants(CombatStartRequest request) {
        if (request == null) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.REQUEST_MISSING);
        }
        if (request.encounter() == null) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.ENCOUNTER_MISSING);
        }
        List<EncounterSlot> encounterSlots = request.encounter().slots();
        if (encounterSlots == null || encounterSlots.isEmpty()) {
            return CombatStartResult.invalidInput(CombatStartFailureReason.ENCOUNTER_SLOTS_INVALID);
        }
        List<PreparedEncounterSlot> preparedSlots = EncounterLootService.assignLootToSlots(
                encounterSlots,
                request.encounter().averageLevel(),
                request.party() != null ? request.party().size() : request.encounter().partySize());
        CombatSetup.BuildCombatantsResult result = CombatSetup.buildCombatants(
                request.party(),
                request.pcInitiatives(),
                preparedSlots,
                request.monsterInitiatives()
        );
        if (result.status() == CombatSetup.BuildCombatantsStatus.SUCCESS) {
            return CombatStartResult.success(result.combatants());
        }
        return CombatStartResult.invalidInput(mapCombatStartFailureReason(result.failureReason()));
    }

    public XpCalculator.DifficultyStats computeLiveDifficultyStats(
            List<Combatant> combatants, int partySize, int avgLevel) {
        return CombatSetup.computeLiveStats(combatants, partySize, avgLevel);
    }

    public CombatOutcomeService.CombatRewardsSettlement settleCombatRewards(
            List<CombatSession.EnemyOutcome> outcomes,
            int partySize,
            double defeatThreshold,
            double xpFraction,
            Set<MonsterCombatant> optionalLootSelections) {
        return CombatOutcomeService.settleRewards(
                outcomes,
                partySize,
                defeatThreshold,
                xpFraction,
                optionalLootSelections);
    }

    private static CombatStartFailureReason mapCombatStartFailureReason(
            CombatSetup.BuildCombatantsFailureReason failureReason) {
        if (failureReason == null) {
            return CombatStartFailureReason.PC_INITIATIVE_COUNT_MISMATCH;
        }
        return switch (failureReason) {
            case PARTY_MISSING -> CombatStartFailureReason.PARTY_MISSING;
            case PC_INITIATIVES_MISSING -> CombatStartFailureReason.PC_INITIATIVES_MISSING;
            case SLOTS_MISSING, SLOTS_INVALID -> CombatStartFailureReason.ENCOUNTER_SLOTS_INVALID;
            case PARTY_MEMBER_MISSING -> CombatStartFailureReason.PARTY_MEMBER_MISSING;
            case PC_INITIATIVE_VALUE_MISSING -> CombatStartFailureReason.PC_INITIATIVE_VALUE_MISSING;
            case PC_INITIATIVE_COUNT_MISMATCH -> CombatStartFailureReason.PC_INITIATIVE_COUNT_MISMATCH;
        };
    }
}
