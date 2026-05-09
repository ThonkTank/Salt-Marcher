package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewIntentHandlerDependencyBoundary",
        summary = "IntentHandlers may depend only on their co-located model and local carrier seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewIntentHandlerDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (source.role() != ViewRole.INTENT_HANDLER || !source.isActiveRootSource()) {
            return Description.NO_MATCH;
        }

        String packageName = source.packageName();
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                ViewRoleDependencySupport.SourceRole.INTENT_HANDLER);
        Set<String> legacyPublishedEventProtocols = collectLegacyPublishedEventProtocols(tree);
        forbiddenReferences.addAll(legacyPublishedEventProtocols);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("IntentHandler package '" + packageName
                        + "' violates IntentHandler dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static Set<String> collectLegacyPublishedEventProtocols(CompilationUnitTree tree) {
        Set<String> violations = new java.util.LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethod(MethodTree methodTree, Void unused) {
                if ("onPublishedEventRequested".contentEquals(methodTree.getName())) {
                    violations.add("legacy outward seam " + methodTree.getName() + "(...)");
                } else if (referencesPublishedEvent(methodTree)) {
                    violations.add("PublishedEvent-coupled method " + methodTree.getName() + "(...)");
                }
                return super.visitMethod(methodTree, unused);
            }

            @Override
            public Void visitVariable(VariableTree variableTree, Void unused) {
                if (referencesPublishedEvent(variableTree)) {
                    violations.add("PublishedEvent-coupled field " + variableTree.getName());
                }
                return super.visitVariable(variableTree, unused);
            }
        }.scan(tree, null);
        return violations;
    }

    private static boolean referencesPublishedEvent(Tree tree) {
        Set<String> referencedTypes = new java.util.LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(tree, referencedTypes);
        return referencedTypes.stream()
                .map(ViewArchitectureSupport::topLevelQualifiedTypeNameOf)
                .anyMatch(ViewArchitectureSupport::isTargetPublishedEventReference);
    }
}
