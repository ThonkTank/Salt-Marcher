package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class EncounterStateIntentHandler {

    private final EncounterStatePresentationModel presentationModel;
    private Consumer<EncounterStatePresentationModel.ActionIntent> actionListener = ignored -> {};

    EncounterStateIntentHandler(EncounterStatePresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onActionRequested(Consumer<EncounterStatePresentationModel.ActionIntent> listener) {
        actionListener = listener == null ? ignored -> {} : listener;
    }

    void refreshPartyContext() {
        actionListener.accept(presentationModel.refreshPartyContext());
    }

    void generate() {
        actionListener.accept(presentationModel.generate());
    }

    void shiftGeneratedAlternative(int delta) {
        actionListener.accept(presentationModel.shiftGeneratedAlternative(delta));
    }

    void saveCurrentPlan() {
        actionListener.accept(presentationModel.saveCurrentPlan());
    }

    void openSavedPlan(long planId) {
        actionListener.accept(presentationModel.openSavedPlan(planId));
    }

    void clearGenerationHistory() {
        actionListener.accept(presentationModel.clearGenerationHistory());
    }

    void addCreature(long creatureId) {
        actionListener.accept(presentationModel.addCreature(creatureId));
    }

    void incrementCreature(long creatureId) {
        actionListener.accept(presentationModel.incrementCreature(creatureId));
    }

    void decrementCreature(long creatureId) {
        actionListener.accept(presentationModel.decrementCreature(creatureId));
    }

    void removeCreature(long creatureId) {
        actionListener.accept(presentationModel.removeCreature(creatureId));
    }

    void undoRemove(long token) {
        actionListener.accept(presentationModel.undoRemove(token));
    }

    void openInitiative() {
        actionListener.accept(presentationModel.openInitiative());
    }

    void backToBuilder() {
        actionListener.accept(presentationModel.backToBuilder());
    }

    void confirmInitiative(List<EncounterStatePresentationModel.InitiativeEntry> initiatives) {
        actionListener.accept(presentationModel.confirmInitiative(initiatives));
    }

    void nextTurn() {
        actionListener.accept(presentationModel.nextTurn());
    }

    void setInitiative(String combatantId, int initiative) {
        actionListener.accept(presentationModel.setInitiative(combatantId, initiative));
    }

    void addPartyMemberToCombat(long partyMemberId, int initiative) {
        actionListener.accept(presentationModel.addPartyMemberToCombat(partyMemberId, initiative));
    }

    void endCombat() {
        actionListener.accept(presentationModel.endCombat());
    }

    void awardXp() {
        actionListener.accept(presentationModel.awardXp());
    }

    void returnToBuilderAfterResults() {
        actionListener.accept(presentationModel.returnToBuilderAfterResults());
    }

    void mutateHp(String combatantId, int amount, boolean healing) {
        actionListener.accept(presentationModel.mutateHp(combatantId, amount, healing));
    }
}
