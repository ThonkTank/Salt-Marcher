package src.view.party.View;

import org.jspecify.annotations.Nullable;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import javafx.stage.Window;
import src.view.party.Controller.PartyController;
import src.view.party.Model.PartyViewData;

import java.util.Optional;

final class PartyToolbarDialogs {

    private PartyToolbarDialogs() {
    }

    static void showCreateDialog(PartyController controller, @Nullable Window owner) {
        Optional<PartyCharacterEditorDialog.CreateRequest> request = PartyCharacterEditorDialog.showCreate(owner);
        request.ifPresent(value -> controller.createCharacter(
                value.draft().name(),
                value.draft().playerName(),
                value.draft().level(),
                value.draft().passivePerception(),
                value.draft().armorClass(),
                value.startInActiveParty()));
    }

    static void showEditDialog(PartyController controller, PartyViewData.PartyMemberViewData member, @Nullable Window owner) {
        Optional<PartyCharacterEditorDialog.CharacterDraft> draft = PartyCharacterEditorDialog.showEdit(owner, member);
        draft.ifPresent(value -> controller.updateCharacter(
                member.id(),
                value.name(),
                value.playerName(),
                value.level(),
                value.passivePerception(),
                value.armorClass()));
    }

    static void confirmDelete(PartyController controller, PartyViewData.PartyMemberViewData member, @Nullable Window owner) {
        Alert alert = new Alert(Alert.AlertType.CONFIRMATION,
                "Delete \"" + member.name() + "\"?",
                ButtonType.OK,
                ButtonType.CANCEL);
        if (owner != null) {
            alert.initOwner(owner);
        }
        alert.setHeaderText("Delete character");
        if (alert.showAndWait().orElse(ButtonType.CANCEL) == ButtonType.OK) {
            controller.deleteCharacter(member.id());
        }
    }

    static void promptForXp(PartyController controller, PartyViewData.PartyMemberViewData member, @Nullable Window owner) {
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
            controller.awardXp(member.id(), Integer.parseInt(rawValue.get().trim()));
        } catch (NumberFormatException exception) {
            // Invalid input is ignored here; controller refresh will preserve current state.
        }
    }
}
