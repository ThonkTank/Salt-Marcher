package src.domain.encounter.model.generation.model;

public final class EncounterProfileCopies {

    private static final int HIGH_XP_COPY_LIMIT = 1_800;
    private static final int MID_XP_COPY_LIMIT = 450;
    private static final int LOW_XP_COPY_LIMIT = 100;

    private EncounterProfileCopies() {
    }

    public static int maxAdditionalCopies(EncounterCandidateProfile profile) {
        if (EncounterRoleNames.BOSS.equals(profile.role()) || profile.combatStats().legendaryActionCount() > 0) {
            return 1;
        }
        if (profile.xp() >= HIGH_XP_COPY_LIMIT) {
            return 2;
        }
        if (profile.xp() >= MID_XP_COPY_LIMIT) {
            return 3;
        }
        if (profile.xp() >= LOW_XP_COPY_LIMIT) {
            return 4;
        }
        return 6;
    }
}
