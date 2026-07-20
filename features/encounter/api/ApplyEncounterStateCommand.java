package features.encounter.api;

import java.util.List;
import java.util.Objects;

public record ApplyEncounterStateCommand(
        Action action,
        long creatureId,
        long planId,
        long worldNpcId,
        int delta,
        long undoToken,
        List<InitiativeValue> initiativeValues,
        String combatantId,
        int initiative,
        long partyMemberId,
        int amount,
        boolean healing
) {

    public ApplyEncounterStateCommand {
        action = Objects.requireNonNull(action, "action");
        creatureId = Math.max(0L, creatureId);
        planId = Math.max(0L, planId);
        worldNpcId = Math.max(0L, worldNpcId);
        undoToken = Math.max(0L, undoToken);
        initiativeValues = initiativeValues == null ? List.of() : List.copyOf(initiativeValues);
        combatantId = combatantId == null ? "" : combatantId;
        partyMemberId = Math.max(0L, partyMemberId);
        amount = Math.max(0, amount);
    }

    public int actionCode() {
        return action.code();
    }

    public static ApplyEncounterStateCommand generate() {
        return action(Action.GENERATE);
    }

    public static ApplyEncounterStateCommand saveCurrentPlan() {
        return action(Action.SAVE_CURRENT_PLAN);
    }

    public static ApplyEncounterStateCommand openSavedPlan(long planId) {
        return plan(Action.OPEN_SAVED_PLAN, planId);
    }

    public static ApplyEncounterStateCommand clearGenerationHistory() {
        return action(Action.CLEAR_GENERATION_HISTORY);
    }

    public static ApplyEncounterStateCommand shiftAlternative(int delta) {
        return delta(Action.SHIFT_ALTERNATIVE, delta);
    }

    public static ApplyEncounterStateCommand addCreature(long creatureId) {
        return creature(Action.ADD_CREATURE, creatureId);
    }

    public static ApplyEncounterStateCommand addWorldNpcCreature(long creatureId, long worldNpcId) {
        return worldNpc(Action.ADD_CREATURE, creatureId, worldNpcId);
    }

    public static ApplyEncounterStateCommand incrementCreature(long creatureId) {
        return creature(Action.INCREMENT_CREATURE, creatureId);
    }

    public static ApplyEncounterStateCommand decrementCreature(long creatureId) {
        return creature(Action.DECREMENT_CREATURE, creatureId);
    }

    public static ApplyEncounterStateCommand removeCreature(long creatureId) {
        return creature(Action.REMOVE_CREATURE, creatureId);
    }

    public static ApplyEncounterStateCommand undoRemove(long undoToken) {
        return undo(Action.UNDO_REMOVE, undoToken);
    }

    public static ApplyEncounterStateCommand openInitiative() {
        return action(Action.OPEN_INITIATIVE);
    }

    public static ApplyEncounterStateCommand backToBuilder() {
        return action(Action.BACK_TO_BUILDER);
    }

    public static ApplyEncounterStateCommand confirmInitiative(List<String> ids, List<Integer> initiatives) {
        return initiatives(Action.CONFIRM_INITIATIVE, ids, initiatives);
    }

    public static ApplyEncounterStateCommand advanceTurn() {
        return action(Action.ADVANCE_TURN);
    }

    public static ApplyEncounterStateCommand endCombat() {
        return action(Action.END_COMBAT);
    }

    public static ApplyEncounterStateCommand mutateHitPoints(String combatantId, int amount, boolean healing) {
        return hitPoints(Action.MUTATE_HP, combatantId, amount, healing);
    }

    public static ApplyEncounterStateCommand adjustInitiative(String combatantId, int initiative) {
        return initiative(Action.ADJUST_INITIATIVE, combatantId, initiative);
    }

    public static ApplyEncounterStateCommand addPartyMemberToCombat(long partyMemberId, int initiative) {
        return partyMember(Action.ADD_PARTY_MEMBER_TO_COMBAT, partyMemberId, initiative);
    }

    public static ApplyEncounterStateCommand awardXp() {
        return action(Action.AWARD_XP);
    }

    public static ApplyEncounterStateCommand returnToBuilderAfterResults() {
        return action(Action.RETURN_TO_BUILDER_AFTER_RESULTS);
    }

    public static ApplyEncounterStateCommand action(Action action) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand creature(Action action, long creatureId) {
        return new ApplyEncounterStateCommand(
                action,
                creatureId,
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand worldNpc(Action action, long creatureId, long worldNpcId) {
        return new ApplyEncounterStateCommand(
                action,
                creatureId,
                0L,
                worldNpcId,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand plan(Action action, long planId) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                planId,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand delta(Action action, int delta) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                delta,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand undo(Action action, long undoToken) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                undoToken,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand initiatives(
            Action action,
            List<String> ids,
            List<Integer> initiatives
    ) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                0L,
                initiativeValues(ids, initiatives),
                "",
                0,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand hitPoints(
            Action action,
            String combatantId,
            int amount,
            boolean healing
    ) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                0L,
                List.of(),
                combatantId,
                0,
                0L,
                amount,
                healing);
    }

    public static ApplyEncounterStateCommand initiative(Action action, String combatantId, int initiative) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                0L,
                List.of(),
                combatantId,
                initiative,
                0L,
                0,
                false);
    }

    public static ApplyEncounterStateCommand partyMember(Action action, long partyMemberId, int initiative) {
        return new ApplyEncounterStateCommand(
                action,
                0L,
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                initiative,
                partyMemberId,
                0,
                false);
    }

    public List<String> initiativeIds() {
        List<String> ids = new java.util.ArrayList<>();
        for (InitiativeValue value : initiativeValues) {
            ids.add(value.id());
        }
        return List.copyOf(ids);
    }

    public List<Integer> initiativeScores() {
        List<Integer> scores = new java.util.ArrayList<>();
        for (InitiativeValue value : initiativeValues) {
            scores.add(Integer.valueOf(value.initiative()));
        }
        return List.copyOf(scores);
    }

    private static List<InitiativeValue> initiativeValues(List<String> ids, List<Integer> initiatives) {
        List<String> safeIds = ids == null ? List.of() : List.copyOf(ids);
        List<Integer> safeInitiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        int count = Math.min(safeIds.size(), safeInitiatives.size());
        List<InitiativeValue> values = new java.util.ArrayList<>();
        for (int index = 0; index < count; index++) {
            values.add(new InitiativeValue(safeIds.get(index), safeInitiatives.get(index)));
        }
        return List.copyOf(values);
    }

    public enum Action {
        REFRESH(1),
        GENERATE(2),
        SAVE_CURRENT_PLAN(3),
        OPEN_SAVED_PLAN(4),
        CLEAR_GENERATION_HISTORY(5),
        SHIFT_ALTERNATIVE(6),
        ADD_CREATURE(7),
        INCREMENT_CREATURE(8),
        DECREMENT_CREATURE(9),
        REMOVE_CREATURE(10),
        UNDO_REMOVE(11),
        OPEN_INITIATIVE(12),
        BACK_TO_BUILDER(13),
        CONFIRM_INITIATIVE(14),
        ADVANCE_TURN(15),
        ADJUST_INITIATIVE(16),
        ADD_PARTY_MEMBER_TO_COMBAT(17),
        END_COMBAT(18),
        AWARD_XP(19),
        RETURN_TO_BUILDER_AFTER_RESULTS(20),
        MUTATE_HP(21);

        private final int code;

        Action(int code) {
            this.code = code;
        }

        private int code() {
            return code;
        }
    }

    public record InitiativeValue(
            String id,
            int initiative
    ) {
        public InitiativeValue {
            id = id == null ? "" : id;
        }
    }
}
