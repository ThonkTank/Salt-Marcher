package src.view.party.View;

import org.jspecify.annotations.Nullable;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import javafx.stage.Window;
import src.view.party.ViewModel.PartyCharacterMutationRequest;
import src.view.party.ViewModel.PartyToolbarViewModel;
import src.view.party.ViewModel.PartyViewData;

import java.util.Optional;

final class PartyToolbarDialogs {

    private PartyToolbarDialogs() {
    }

    static void showCreateDialog(PartyToolbarViewModel viewModel, @Nullable Window owner) {
        Optional<PartyCharacterEditorDialog.CreateRequest> request = PartyCharacterEditorDialog.showCreate(owner);
        request.ifPresent(value -> viewModel.createCharacter(toViewModelRequest(
                value.draft(),
                value.startInActiveParty())));
    }

    static void showEditDialog(
            PartyToolbarViewModel viewModel,
            PartyViewData.PartyMemberViewData member,
            @Nullable Window owner
    ) {
        Optional<PartyCharacterEditorDialog.CharacterDraft> draft = PartyCharacterEditorDialog.showEdit(owner, member);
        draft.ifPresent(value -> viewModel.updateCharacter(
                member.id(),
                toViewModelRequest(value, member.membership() == PartyViewData.MembershipSelection.ACTIVE)));
    }

    static void confirmDelete(
            PartyToolbarViewModel viewModel,
            PartyViewData.PartyMemberViewData member,
            @Nullable Window owner
    ) {
        Alert alert = new Alert(Alert.AlertType.CONFIRMATION,
                "Delete \"" + member.name() + "\"?",
                ButtonType.OK,
                ButtonType.CANCEL);
        if (owner != null) {
            alert.initOwner(owner);
        }
        alert.setHeaderText("Delete character");
        if (alert.showAndWait().orElse(ButtonType.CANCEL) == ButtonType.OK) {
            viewModel.deleteCharacter(member.id());
        }
    }

    static void promptForXp(
            PartyToolbarViewModel viewModel,
            PartyViewData.PartyMemberViewData member,
            @Nullable Window owner
    ) {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Award XP");
        dialog.setHeaderText("Award XP to " + member.name());
        dialog.setContentText("XP amount:");
        if (owner != null) {
            dialog.initOwner(owner);
        }
        Optional<String> rawValue = dialog.showAndWait();
        if (rawValue.isEmpty()) {
            return;
        }
        try {
            viewModel.awardXp(member.id(), Integer.parseInt(rawValue.get().trim()));
        } catch (NumberFormatException exception) {
            // Invalid input is ignored here; controller refresh will preserve current state.
        }
    }

    private static PartyCharacterMutationRequest toViewModelRequest(
            PartyCharacterEditorDialog.CharacterDraft draft,
            boolean activeMembership
    ) {
        return new PartyCharacterMutationRequest(
                draft.name(),
                draft.playerName(),
                draft.level(),
                draft.passivePerception(),
                draft.armorClass(),
                activeMembership);
    }
}
