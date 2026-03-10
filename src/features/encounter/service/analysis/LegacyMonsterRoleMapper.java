package features.encounter.service.analysis;

import features.encounter.model.EncounterFunctionRole;
import features.encounter.model.EncounterWeightClass;
import features.encounter.repository.EncounterPartyAnalysisRepository.CreatureStaticRow;
import features.gamerules.model.MonsterRole;

public final class LegacyMonsterRoleMapper {
    private LegacyMonsterRoleMapper() {
        throw new AssertionError("No instances");
    }

    public static MonsterRole toMonsterRole(
            EncounterWeightClass weightClass,
            EncounterFunctionRole functionRole,
            CreatureStaticRow staticRow,
            double survivabilityActions,
            double offensePressure) {
        if (weightClass == EncounterWeightClass.MINION) {
            return MonsterRole.MINION;
        }
        if (functionRole == EncounterFunctionRole.SUPPORT) {
            return weightClass == EncounterWeightClass.BOSS ? MonsterRole.LEADER : MonsterRole.SUPPORT;
        }
        if (functionRole == EncounterFunctionRole.CONTROLLER) {
            return MonsterRole.CONTROLLER;
        }
        if (functionRole == EncounterFunctionRole.SKIRMISHER) {
            return MonsterRole.SKIRMISHER;
        }
        if (functionRole == EncounterFunctionRole.ARCHER) {
            return (weightClass == EncounterWeightClass.BOSS || offensePressure >= 0.085)
                    ? MonsterRole.ARTILLERY
                    : MonsterRole.ARCHER;
        }
        if (weightClass == EncounterWeightClass.BOSS) {
            return staticRow.meleeSignalScore() >= staticRow.rangedSignalScore() && survivabilityActions >= 4.0
                    ? MonsterRole.BRUTE
                    : MonsterRole.TANK;
        }
        return MonsterRole.SOLDIER;
    }
}
