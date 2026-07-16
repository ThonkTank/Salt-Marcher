package features.encounter.domain.generation;

final class EncounterRolePredicateModel {

    private EncounterRolePredicateModel() {
    }

    static boolean minion(EncounterRole role) {
        return switch (role) {
            case MINION -> true;
            case BOSS, BRUTE, SKIRMISHER, ELITE, STANDARD -> false;
        };
    }
}
