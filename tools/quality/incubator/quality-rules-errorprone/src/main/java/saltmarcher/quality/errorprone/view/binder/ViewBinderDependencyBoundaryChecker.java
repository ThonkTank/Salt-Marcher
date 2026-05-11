package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewBinderDependencyBoundary",
        summary = "Binders may depend only on documented shell, domain, view, and slotcontent seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isActiveRootSource() || source.role() != ViewRole.BINDER) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = collectForbiddenReferences(tree, state, source);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Binder package '" + source.packageName()
                        + "' violates Binder dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static Set<String> collectForbiddenReferences(
            CompilationUnitTree tree,
            VisitorState state,
            ViewSourceDescriptor source
    ) {
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, source, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbiddenReference(
            String referencedType,
            ViewSourceDescriptor source,
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
            return !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedViewModelDomainBoundary(referencedType);
        }
        ViewSourceDescriptor referencedSource = ViewSourceDescriptor.describeReferencedType(referencedType);
        if (!referencedSource.isRecognizedViewSource()) {
            return false;
        }
        if (referencedSource.isDetailEntrySource() || referencedSource.isReusableProjectionModelSource()) {
            return false;
        }
        return switch (referencedSource.role()) {
            case VIEW_INPUT_EVENT -> !source.isSameViewUnitOrReusableSlotcontent(referencedSource, ViewRole.VIEW_INPUT_EVENT);
            case PUBLISHED_EVENT -> true;
            case CONTRIBUTION, BINDER, CONTRIBUTION_MODEL, CONTENT_MODEL, INTENT_HANDLER ->
                    !source.isSameViewUnitAs(referencedSource);
            case VIEW -> !source.isSameViewUnitOrReusableSlotcontent(referencedSource, ViewRole.VIEW);
            default -> true;
        };
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
