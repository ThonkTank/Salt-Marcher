package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class PartyTopBarIntentHandler {

    private final PartyTopBarPresentationModel presentationModel;
    private Runnable refreshListener = () -> {};
    private Consumer<PartyTopBarPresentationModel.ActionIntent> actionListener = ignored -> {};

    PartyTopBarIntentHandler(PartyTopBarPresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onRefreshRequested(Runnable listener) {
        refreshListener = listener == null ? () -> {} : listener;
    }

    void onActionRequested(Consumer<PartyTopBarPresentationModel.ActionIntent> listener) {
        actionListener = listener == null ? ignored -> {} : listener;
    }

    void refresh() {
        presentationModel.refresh();
        refreshListener.run();
    }

    PartyTopBarPresentationModel.ActionResult addExisting(@Nullable Long id, String name) {
        return dispatch(presentationModel.addExisting(id, name));
    }

    PartyTopBarPresentationModel.ActionResult removeFromParty(@Nullable Long id, String name) {
        return dispatch(presentationModel.removeFromParty(id, name));
    }

    PartyTopBarPresentationModel.ActionResult adjustXp(@Nullable Long id, String name, int xpDelta) {
        return dispatch(presentationModel.adjustXp(id, name, xpDelta));
    }

    PartyTopBarPresentationModel.ActionResult shortRest() {
        return dispatch(presentationModel.shortRest());
    }

    PartyTopBarPresentationModel.ActionResult longRest() {
        return dispatch(presentationModel.longRest());
    }

    PartyTopBarPresentationModel.ActionResult createCharacter(PartyTopBarPresentationModel.CharacterDraftModel draft) {
        return dispatch(presentationModel.createCharacter(draft));
    }

    PartyTopBarPresentationModel.ActionResult updateCharacter(PartyTopBarPresentationModel.CharacterDraftModel draft) {
        return dispatch(presentationModel.updateCharacter(draft));
    }

    PartyTopBarPresentationModel.ActionResult deleteCharacter(@Nullable Long id, String name) {
        return dispatch(presentationModel.deleteCharacter(id, name));
    }

    private PartyTopBarPresentationModel.ActionResult dispatch(PartyTopBarPresentationModel.ActionPlan plan) {
        PartyTopBarPresentationModel.ActionPlan safePlan = plan == null
                ? new PartyTopBarPresentationModel.ActionPlan(
                        PartyTopBarPresentationModel.ActionResult.failure("Party-Aktion konnte nicht gespeichert werden."),
                        null)
                : plan;
        if (safePlan.intent() != null) {
            actionListener.accept(safePlan.intent());
        }
        return safePlan.result();
    }
}
