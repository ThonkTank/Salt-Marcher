package saltmarcher.architecture.view;

public enum ViewRole {
    CONTRIBUTION("Contribution.java"),
    BINDER("Binder.java"),
    CONTRIBUTION_MODEL("ContributionModel.java"),
    CONTENT_MODEL("ContentModel.java"),
    INTENT_HANDLER("IntentHandler.java"),
    VIEW_INPUT_EVENT("ViewInputEvent.java"),
    PUBLISHED_EVENT("PublishedEvent.java"),
    INSPECTOR_ENTRY("InspectorEntry.java"),
    LEGACY_VIEW_MODEL("ViewModel.java", "PresentationModel.java"),
    PROJECTOR("Projector.java"),
    VIEW("View.java"),
    UNKNOWN();

    private final String[] suffixes;

    ViewRole(String... suffixes) {
        this.suffixes = suffixes;
    }

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

    public boolean isAllowedIn(ViewUnitKind unitKind) {
        return switch (unitKind) {
            case ACTIVE_ROOT -> switch (this) {
                case CONTRIBUTION, BINDER, CONTRIBUTION_MODEL, INTENT_HANDLER,
                        VIEW_INPUT_EVENT, PUBLISHED_EVENT, VIEW -> true;
                default -> false;
            };
            case REUSABLE_SLOTCONTENT -> switch (this) {
                case CONTENT_MODEL, VIEW_INPUT_EVENT, VIEW -> true;
                default -> false;
            };
        };
    }

    public boolean isProjectionModel() {
        return this == CONTRIBUTION_MODEL || this == CONTENT_MODEL;
    }

    public boolean hasStem() {
        return suffixes.length > 0 && this != UNKNOWN;
    }

    public String stem(String fileName) {
        for (String suffix : suffixes) {
            if (fileName.endsWith(suffix)) {
                return fileName.substring(0, fileName.length() - suffix.length());
            }
        }
        return "";
    }
}
