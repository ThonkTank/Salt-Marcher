package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

public final class ViewIntentHandlerBoundaryCheckers {

    private ViewIntentHandlerBoundaryCheckers() {
    }

    private abstract static class IntentHandlerBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public final Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!source.isRecognizedViewSource() || source.role() != ViewRole.INTENT_HANDLER) {
                return Description.NO_MATCH;
            }
            return intentHandlerViolation(tree, state, source, this);
        }

        abstract Description intentHandlerViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker);
    }

    @BugPattern(
            name = "ViewIntentHandlerDependencyBoundary",
            summary = "IntentHandlers may depend only on their co-located model and local carrier seams.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewIntentHandlerDependencyBoundaryChecker
            extends IntentHandlerBoundaryChecker {

        @Override
        Description intentHandlerViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker
        ) {
            if (!source.isActiveRootSource()) {
                return Description.NO_MATCH;
            }

            Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                    tree,
                    state,
                    ViewRoleDependencySupport.SourceRole.INTENT_HANDLER);
            forbiddenReferences.addAll(collectLegacyPublishedEventProtocols(tree));
            if (forbiddenReferences.isEmpty()) {
                return Description.NO_MATCH;
            }
            return checker.buildDescription(boundaryAnchor(tree))
                    .setMessage("IntentHandler package '" + source.packageName()
                            + "' violates IntentHandler dependency boundaries via references: "
                            + String.join(", ", forbiddenReferences))
                    .build();
        }
    }

    @BugPattern(
            name = "ViewIntentHandlerViewInputEvent",
            summary = "IntentHandlers must expose consume(...) entrypoints for same-root and reused slotcontent ViewInputEvent input.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewIntentHandlerViewInputEventChecker
            extends IntentHandlerBoundaryChecker {

        @Override
        Description intentHandlerViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker
        ) {
            ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
            if (topLevelClass == null) {
                return Description.NO_MATCH;
            }

            Set<String> violations = new LinkedHashSet<>();
            boolean hasAllowedConsumeMethod = false;
            for (var member : topLevelClass.getMembers()) {
                if (!(member instanceof MethodTree methodTree)) {
                    continue;
                }
                if (isAllowedConsumeMethod(methodTree, source.packageName())) {
                    hasAllowedConsumeMethod = true;
                    collectDiscriminatorDispatchViolations(methodTree, source.packageName(), violations);
                }
            }

            if (!hasAllowedConsumeMethod) {
                return checker.buildDescription(boundaryAnchor(tree))
                        .setMessage("IntentHandlers must expose a fire-and-forget consume(...) entrypoint for their same-root or reused slotcontent ViewInputEvent surfaces.")
                        .build();
            }
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return checker.buildDescription(boundaryAnchor(tree))
                    .setMessage("IntentHandlers must derive meaning from concrete ViewInputEvent snapshot fields instead of dispatching via source/action discriminators. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    private static Set<String> collectLegacyPublishedEventProtocols(CompilationUnitTree tree) {
        Set<String> violations = new LinkedHashSet<>();
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
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(tree, referencedTypes);
        return referencedTypes.stream()
                .map(ViewArchitectureSupport::topLevelQualifiedTypeNameOf)
                .anyMatch(ViewArchitectureSupport::isTargetPublishedEventReference);
    }

    private static boolean isAllowedConsumeMethod(MethodTree methodTree, String sourcePackageName) {
        if (!"consume".contentEquals(methodTree.getName())
                || methodTree.getParameters().size() != 1
                || methodTree.getReturnType() == null
                || !"void".contentEquals(methodTree.getReturnType().toString())) {
            return false;
        }
        VariableTree parameter = methodTree.getParameters().get(0);
        return referencesAllowedViewInputEvent(parameter, sourcePackageName);
    }

    private static boolean referencesAllowedViewInputEvent(
            VariableTree parameter,
            String sourcePackageName
    ) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(parameter.getType(), referencedTypes);
        if (referencedTypes.isEmpty()) {
            String renderedType = ASTHelpers.getType(parameter.getType()) == null
                    ? ""
                    : ASTHelpers.getType(parameter.getType()).toString();
            if (!renderedType.isBlank()) {
                referencedTypes.add(renderedType);
            }
        }
        return referencedTypes.stream()
                .anyMatch(referencedType ->
                        ViewArchitectureSupport.isTargetViewInputEventReference(referencedType)
                                && ViewArchitectureSupport.isSameViewRootOrReusableSlotcontentViewInputEventReference(
                                sourcePackageName,
                                referencedType));
    }

    private static void collectDiscriminatorDispatchViolations(
            MethodTree methodTree,
            String sourcePackageName,
            Set<String> violations
    ) {
        VariableTree parameter = methodTree.getParameters().get(0);
        Symbol parameterSymbol = ASTHelpers.getSymbol(parameter);
        if (parameterSymbol == null || methodTree.getBody() == null) {
            return;
        }
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (methodSymbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String methodName = methodSymbol.getSimpleName().toString();
                if (!"source".equals(methodName) && !"action".equals(methodName)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                ExpressionTree receiver = ASTHelpers.getReceiver(methodInvocationTree);
                Symbol receiverSymbol = receiver == null ? null : ASTHelpers.getSymbol(receiver);
                if (receiverSymbol == null || !receiverSymbol.equals(parameterSymbol)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (referencesAllowedViewInputEvent(parameter, sourcePackageName)) {
                    violations.add(methodTree.getName() + "(" + parameter.getType() + ")." + methodName + "()");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(methodTree.getBody(), null);
    }

    private static Tree boundaryAnchor(CompilationUnitTree tree) {
        Tree anchor = ViewArchitectureSupport.topLevelClass(tree);
        return anchor == null ? tree : anchor;
    }
}
