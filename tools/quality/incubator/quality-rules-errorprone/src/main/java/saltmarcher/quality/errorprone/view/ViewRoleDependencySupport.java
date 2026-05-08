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
        INTENT_HANDLER
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
                case CONTRIBUTION, INTENT_HANDLER -> true;
                case BINDER -> !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL -> !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
            };
        }
        if (referencedType.startsWith("shell.")) {
            return switch (sourceRole) {
                case CONTRIBUTION -> !ViewRolePolicy.isAllowedContributionShellType(referencedType);
                case BINDER -> !ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL, INTENT_HANDLER -> true;
            };
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return switch (sourceRole) {
                case BINDER -> !ViewArchitectureSupport.isAllowedViewModelDomainBoundary(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL ->
                        !ViewArchitectureSupport.isAllowedPresentationModelDomainBoundary(referencedType);
                case INTENT_HANDLER -> !ViewArchitectureSupport.isAllowedIntentHandlerDomainBoundary(
                        sourcePackageName,
                        referencedType);
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
                || ViewArchitectureSupport.isSlotcontentModelReference(referencedType)) {
            return false;
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                    sourcePackageName,
                    referencedType);
        }
        if ("PUBLISHED_EVENT".equals(viewType.bucket())) {
            return true;
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
        return true;
    }

    private static boolean isForbiddenForIntentHandler(
            String sourcePackageName,
            String referencedType,
            ViewArchitectureSupport.ViewTypeInfo viewType
    ) {
        if ("HANDLER".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                    sourcePackageName,
                    referencedType);
        }
        if ("PUBLISHED_EVENT".equals(viewType.bucket())) {
            return true;
        }
        return !"MODEL".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentModelReference(
                        sourcePackageName,
                        referencedType);
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
