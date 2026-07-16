package platform.ui.catalogcrud;

public record CatalogCrudControlsViewInputEvent(
        String selectedItemId,
        String selectorFilterText,
        String openItemId,
        boolean createEditorOpened,
        String createDraftName,
        String renameEditorItemId,
        String renameItemId,
        String renameDraftName,
        String deleteRequestItemId,
        String deleteConfirmItemId,
        boolean dismissed,
        String reloadItemId
) {

    public CatalogCrudControlsViewInputEvent {
        selectedItemId = selectedItemId == null ? "" : selectedItemId.trim();
        selectorFilterText = selectorFilterText == null ? "" : selectorFilterText.trim();
        openItemId = openItemId == null ? "" : openItemId.trim();
        createDraftName = createDraftName == null ? "" : createDraftName.trim();
        renameEditorItemId = renameEditorItemId == null ? "" : renameEditorItemId.trim();
        renameItemId = renameItemId == null ? "" : renameItemId.trim();
        renameDraftName = renameDraftName == null ? "" : renameDraftName.trim();
        deleteRequestItemId = deleteRequestItemId == null ? "" : deleteRequestItemId.trim();
        deleteConfirmItemId = deleteConfirmItemId == null ? "" : deleteConfirmItemId.trim();
        reloadItemId = reloadItemId == null ? "" : reloadItemId.trim();
    }
}
