package saltmarcher.quality.errorprone.view;

import com.google.errorprone.VisitorState;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

public final class ViewRoleDependencySupport {

    private ViewRoleDependencySupport() {
    }

    public static Set<String> collectForbiddenReferences(
            CompilationUnitTree tree,
            VisitorState state,
            ViewSourceDescriptor source
    ) {
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbidden(referencedType, source, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbidden(String referencedType, ViewSourceDescriptor source, String sourceText) {
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
            return switch (source.role()) {
                case CONTRIBUTION, INTENT_HANDLER -> true;
                case BINDER -> !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL ->
                        !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
                default -> false;
            };
        }
        if (referencedType.startsWith("shell.")) {
            return switch (source.role()) {
                case CONTRIBUTION -> !ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
                case BINDER -> !ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL, INTENT_HANDLER -> true;
                default -> false;
            };
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return switch (source.role()) {
                case CONTRIBUTION -> true;
                case BINDER -> !ViewArchitectureSupport.isAllowedViewModelDomainBoundary(referencedType);
                case CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL ->
                        !ViewArchitectureSupport.isAllowedPresentationModelDomainBoundary(referencedType);
                case INTENT_HANDLER ->
                        !ViewArchitectureSupport.isAllowedIntentHandlerDomainBoundary(source.packageName(), referencedType);
                default -> false;
            };
        }

        ViewSourceDescriptor referencedSource = ViewSourceDescriptor.describeQualifiedType(
                ViewArchitectureSupport.topLevelQualifiedTypeNameOf(referencedType));
        if (!referencedSource.isRecognizedViewSource()) {
            return false;
        }

        return switch (source.role()) {
            case CONTRIBUTION -> isForbiddenForContribution(source, referencedSource);
            case BINDER -> isForbiddenForBinder(source, referencedSource, referencedType);
            case CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL ->
                    isForbiddenForProjectionModel(source, referencedSource);
            case INTENT_HANDLER -> isForbiddenForIntentHandler(source, referencedSource, referencedType);
            default -> false;
        };
    }

    private static boolean isForbiddenForContribution(
            ViewSourceDescriptor source,
            ViewSourceDescriptor referencedSource
    ) {
        if (referencedSource.role() == ViewRole.CONTRIBUTION && isSameRoot(source, referencedSource)) {
            return false;
        }
        return referencedSource.role() != ViewRole.BINDER || !isSameRoot(source, referencedSource);
    }

    private static boolean isForbiddenForBinder(
            ViewSourceDescriptor source,
            ViewSourceDescriptor referencedSource,
            String referencedType
    ) {
        if (ViewArchitectureSupport.isDetailEntryReference(referencedType) || isReusableProjectionModelReference(referencedSource)) {
            return false;
        }
        return switch (referencedSource.role()) {
            case VIEW_INPUT_EVENT ->
                    !(isSameRoot(source, referencedSource)
                            || ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                            source.packageName(),
                            referencedType));
            case PUBLISHED_EVENT -> true;
            case CONTRIBUTION, BINDER, CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL, INTENT_HANDLER ->
                    !isSameRoot(source, referencedSource);
            case VIEW ->
                    !(isSameRoot(source, referencedSource)
                            || ViewArchitectureSupport.isSameViewRootOrReusablePassiveViewReference(
                            source.packageName(),
                            referencedType));
            default -> true;
        };
    }

    private static boolean isForbiddenForProjectionModel(
            ViewSourceDescriptor source,
            ViewSourceDescriptor referencedSource
    ) {
        if (!referencedSource.role().isProjectionModel()) {
            return true;
        }
        if (isSameRoot(source, referencedSource)) {
            return false;
        }
        return source.isSlotcontentSource() || !isReusableProjectionModelReference(referencedSource);
    }

    private static boolean isForbiddenForIntentHandler(
            ViewSourceDescriptor source,
            ViewSourceDescriptor referencedSource,
            String referencedType
    ) {
        return switch (referencedSource.role()) {
            case INTENT_HANDLER -> !isSameRoot(source, referencedSource);
            case VIEW_INPUT_EVENT ->
                    !ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                            source.packageName(),
                            referencedType);
            case PUBLISHED_EVENT -> true;
            default ->
                    !referencedSource.role().isProjectionModel()
                            || !ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentModelReference(
                            source.packageName(),
                            referencedType);
        };
    }

    private static boolean isSameRoot(ViewSourceDescriptor source, ViewSourceDescriptor referencedSource) {
        return source.packageName().equals(referencedSource.packageName());
    }

    private static boolean isReusableProjectionModelReference(ViewSourceDescriptor referencedSource) {
        return referencedSource.isSlotcontentSource() && referencedSource.role().isProjectionModel();
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
