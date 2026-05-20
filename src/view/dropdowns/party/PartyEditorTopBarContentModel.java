package src.view.dropdowns.party;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class PartyEditorTopBarContentModel {

    private final ReadOnlyObjectWrapper<EditorPanelModel> editorPanel =
            new ReadOnlyObjectWrapper<>(EditorPanelModel.hidden());

    public ReadOnlyObjectProperty<EditorPanelModel> editorPanelProperty() {
        return editorPanel.getReadOnlyProperty();
    }

    void showEditor(EditorPanelModel content) {
        editorPanel.set(content == null ? EditorPanelModel.hidden() : content);
    }

    EditorPanelModel currentEditorPanel() {
        EditorPanelModel current = editorPanel.get();
        return current == null ? EditorPanelModel.hidden() : current;
    }

    void openCreateEditor() {
        showEditor(EditorPanelModel.createDraft());
    }

    void cancelEditor() {
        showEditor(EditorPanelModel.hidden());
    }

    void requestDeleteConfirmation() {
        showEditor(currentEditorPanel().withDeleteConfirmationVisible(true));
    }

    void cancelDeleteConfirmation() {
        showEditor(currentEditorPanel().withDeleteConfirmationVisible(false));
    }

    void syncDraft(
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {
        if (!currentEditorPanel().visible()) {
            return;
        }
        showEditor(currentEditorPanel().withDraft(
                memberName,
                playerName,
                rawLevel,
                rawPassivePerception,
                rawArmorClass));
    }

    void showActionsDisabled(boolean actionsDisabled) {
        showEditor(currentEditorPanel().withActionsDisabled(actionsDisabled));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    public record EditorPanelModel(
            boolean visible,
            boolean editingExisting,
            long memberId,
            String memberName,
            String deleteTargetName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass,
            boolean deleteConfirmationVisible,
            boolean actionsDisabled
    ) {

        public EditorPanelModel {
            memberId = Math.max(0L, memberId);
            memberName = safe(memberName);
            deleteTargetName = safe(deleteTargetName);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static EditorPanelModel hidden() {
            return new EditorPanelModel(false, false, 0L, "", "", "", "1", "10", "10", false, false);
        }

        static EditorPanelModel createDraft() {
            return new EditorPanelModel(true, false, 0L, "", "", "", "1", "10", "10", false, false);
        }

        static EditorPanelModel editDraft(
                long memberId,
                String memberName,
                String playerName,
                String rawLevel,
                String rawPassivePerception,
                String rawArmorClass
        ) {
            return new EditorPanelModel(
                    true,
                    true,
                    memberId,
                    memberName,
                    memberName,
                    playerName,
                    rawLevel,
                    rawPassivePerception,
                    rawArmorClass,
                    false,
                    false);
        }

        EditorPanelModel withDeleteConfirmationVisible(boolean visible) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    this.memberName,
                    this.deleteTargetName,
                    this.playerName,
                    this.rawLevel,
                    this.rawPassivePerception,
                    this.rawArmorClass,
                    visible,
                    this.actionsDisabled);
        }

        EditorPanelModel withDraft(
                String memberName,
                String playerName,
                String rawLevel,
                String rawPassivePerception,
                String rawArmorClass
        ) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    memberName,
                    this.deleteTargetName,
                    playerName,
                    rawLevel,
                    rawPassivePerception,
                    rawArmorClass,
                    false,
                    this.actionsDisabled);
        }

        EditorPanelModel withActionsDisabled(boolean actionsDisabled) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    this.memberName,
                    this.deleteTargetName,
                    this.playerName,
                    this.rawLevel,
                    this.rawPassivePerception,
                    this.rawArmorClass,
                    this.deleteConfirmationVisible,
                    actionsDisabled);
        }
    }
}
