package features.encounter.analysis.service;

import features.encounter.analysis.model.CreatureRoleProfile;
import features.encounter.analysis.model.EncounterFunctionRole;
import features.encounter.analysis.model.EncounterWeightClass;
import features.gamerules.model.MonsterRole;

public final class EncounterRoleProjector {
    private EncounterRoleProjector() {
        throw new AssertionError("No instances");
    }

    public static MonsterRole projectMonsterRole(CreatureRoleProfile profile) {
        if (profile == null) {
            return MonsterRole.SOLDIER;
        }
        if (profile.weightClass() == EncounterWeightClass.MINION) {
            return MonsterRole.MINION;
        }
        EncounterFunctionRole primaryRole = profile.primaryFunctionRole();
        if (primaryRole == null) {
            return profile.weightClass() == EncounterWeightClass.BOSS ? MonsterRole.TANK : MonsterRole.SOLDIER;
        }
        return switch (primaryRole) {
            case ARCHER -> profile.weightClass() == EncounterWeightClass.BOSS ? MonsterRole.ARTILLERY : MonsterRole.ARCHER;
            case CONTROLLER -> MonsterRole.CONTROLLER;
            case SKIRMISHER -> MonsterRole.SKIRMISHER;
            case SUPPORT -> profile.weightClass() == EncounterWeightClass.BOSS ? MonsterRole.LEADER : MonsterRole.SUPPORT;
            case SOLDIER -> profile.weightClass() == EncounterWeightClass.BOSS ? MonsterRole.TANK : MonsterRole.SOLDIER;
        };
    }
}
