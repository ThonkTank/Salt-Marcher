package saltmarcher.quality.errorprone.view;

public enum ViewRole {
    CONTRIBUTION,
    BINDER,
    CONTRIBUTION_MODEL,
    CONTENT_MODEL,
    INTENT_HANDLER,
    VIEW_INPUT_EVENT,
    PUBLISHED_EVENT,
    INSPECTOR_ENTRY,
    LEGACY_VIEW_MODEL,
    PROJECTOR,
    VIEW,
    UNKNOWN;

    public static ViewRole fromFileName(String fileName) {
        if (fileName.endsWith("Contribution.java")) {
            return CONTRIBUTION;
        }
        if (fileName.endsWith("Binder.java")) {
            return BINDER;
        }
        if (fileName.endsWith("ContributionModel.java")) {
            return CONTRIBUTION_MODEL;
        }
        if (fileName.endsWith("ContentModel.java")) {
            return CONTENT_MODEL;
        }
        if (fileName.endsWith("IntentHandler.java")) {
            return INTENT_HANDLER;
        }
        if (fileName.endsWith("ViewInputEvent.java")) {
            return VIEW_INPUT_EVENT;
        }
        if (fileName.endsWith("PublishedEvent.java")) {
            return PUBLISHED_EVENT;
        }
        if (fileName.endsWith("InspectorEntry.java")) {
            return INSPECTOR_ENTRY;
        }
        if (fileName.endsWith("ViewModel.java") || fileName.endsWith("PresentationModel.java")) {
            return LEGACY_VIEW_MODEL;
        }
        if (fileName.endsWith("Projector.java")) {
            return PROJECTOR;
        }
        if (fileName.endsWith("View.java")) {
            return VIEW;
        }
        return UNKNOWN;
    }

    public boolean isProjectionModel() {
        return this == LEGACY_VIEW_MODEL
                || this == CONTRIBUTION_MODEL
                || this == CONTENT_MODEL;
    }
}
