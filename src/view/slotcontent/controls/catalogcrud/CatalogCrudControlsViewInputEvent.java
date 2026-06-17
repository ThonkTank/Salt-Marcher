package src.view.slotcontent.controls.catalogcrud;

public record CatalogCrudControlsViewInputEvent(
        String selectedItemId,
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
        createDraftName = createDraftName == null ? "" : createDraftName.trim();
        renameEditorItemId = renameEditorItemId == null ? "" : renameEditorItemId.trim();
        renameItemId = renameItemId == null ? "" : renameItemId.trim();
        renameDraftName = renameDraftName == null ? "" : renameDraftName.trim();
        deleteRequestItemId = deleteRequestItemId == null ? "" : deleteRequestItemId.trim();
        deleteConfirmItemId = deleteConfirmItemId == null ? "" : deleteConfirmItemId.trim();
        reloadItemId = reloadItemId == null ? "" : reloadItemId.trim();
    }
}
