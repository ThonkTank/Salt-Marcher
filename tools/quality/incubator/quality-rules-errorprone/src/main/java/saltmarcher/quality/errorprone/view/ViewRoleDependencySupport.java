package saltmarcher.quality.errorprone.view;

import com.google.errorprone.VisitorState;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

public final class ViewRoleDependencySupport {

    private ViewRoleDependencySupport() {
    }

    public enum SourceRole {
        CONTRIBUTION,
        BINDER,
        CONTRIBUTION_MODEL,
        CONTENT_MODEL,
        INTENT_HANDLER,
        INSPECTOR_ENTRY
    }

    public static Set<String> collectForbiddenReferences(
            CompilationUnitTree tree,
            VisitorState state,
            SourceRole sourceRole
    ) {
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbidden(referencedType, sourceRole, sourcePackageName, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbidden(
            String referencedType,
            SourceRole sourceRole,
            String sourcePackageName,
            String sourceText
    ) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if ("java.util.concurrent.Callable".equals(referencedType)
                && !sourceText.contains("Callable")
                && !sourceText.contains("java.util.concurrent")) {
            return false;
        }
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            return switch (sourceRole) {
                case CONTRIBUTION -> true;
                case BINDER -> !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL -> !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
                case INTENT_HANDLER -> true;
                case INSPECTOR_ENTRY -> !referencedType.equals("javafx.scene.Node");
            };
        }
        if (referencedType.startsWith("shell.")) {
            return switch (sourceRole) {
                case CONTRIBUTION -> !ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
                case BINDER -> !ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL, INTENT_HANDLER -> true;
                case INSPECTOR_ENTRY -> !ViewArchitectureSupport.isAllowedInspectorEntryShellType(referencedType);
            };
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return switch (sourceRole) {
                case CONTRIBUTION -> true;
                case BINDER -> !ViewArchitectureSupport.isAllowedViewModelDomainBoundary(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL ->
                        !ViewArchitectureSupport.isAllowedPresentationModelDomainBoundary(referencedType);
                case INTENT_HANDLER -> true;
                case INSPECTOR_ENTRY ->
                        !referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
            };
        }

        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }

        return switch (sourceRole) {
            case CONTRIBUTION -> isForbiddenForContribution(sourcePackageName, referencedType, viewType);
            case BINDER -> isForbiddenForBinder(sourcePackageName, referencedType, viewType);
            case CONTRIBUTION_MODEL, CONTENT_MODEL ->
                    isForbiddenForProjectionModel(sourcePackageName, referencedType, viewType);
            case INTENT_HANDLER -> isForbiddenForIntentHandler(sourcePackageName, referencedType, viewType);
            case INSPECTOR_ENTRY -> isForbiddenForInspectorEntry(sourcePackageName, referencedType, viewType);
        };
    }

    private static boolean isForbiddenForContribution(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        if ("CONTRIBUTION".equals(viewType.bucket())
                && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)) {
            return false;
        }
        return !"BINDER".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static boolean isForbiddenForBinder(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        if (ViewArchitectureSupport.isDetailEntryReference(referencedType)
                || ViewArchitectureSupport.isSlotcontentModelReference(referencedType)
                || ViewArchitectureSupport.isPrimitiveModelReference(referencedType)
                || "SUPPORT_VALUE".equals(viewType.bucket())) {
            return false;
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket()) || "PUBLISHED_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        if (Set.of("CONTRIBUTION", "BINDER", "MODEL", "HANDLER").contains(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        if ("VIEW".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootOrReusablePassiveViewReference(
                    sourcePackageName,
                    referencedType);
        }
        return true;
    }

    private static boolean isForbiddenForProjectionModel(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        if (!"MODEL".equals(viewType.bucket())) {
            return true;
        }
        if (ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)) {
            return false;
        }
        if (!sourcePackageName.startsWith("src.view.slotcontent.")
                && ViewArchitectureSupport.isSlotcontentModelReference(referencedType)) {
            return false;
        }
        return !ViewArchitectureSupport.isPrimitiveModelReference(referencedType);
    }

    private static boolean isForbiddenForIntentHandler(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        if (Set.of("HANDLER", "VIEW_INPUT_EVENT", "PUBLISHED_EVENT").contains(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        return !"MODEL".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static boolean isForbiddenForInspectorEntry(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        return !Set.of("MODEL", "VIEW", "INSPECTOR_ENTRY").contains(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static String sourceText(CompilationUnitTree tree, VisitorState state) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        try {
            String sourceText = state.getSourceForNode(tree);
            return sourceText == null ? "" : sourceText;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}
