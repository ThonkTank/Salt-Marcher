package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewBinderApplicationSinkWiring",
        summary = "Binders must not inject legacy outward-work sinks such as onPublishedEventRequested(...) into IntentHandlers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderApplicationSinkWiringChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isActiveRootSource() || source.role() != ViewRole.BINDER) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!ViewArchitectureSupport.isIntentHandlerReference(ownerType)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (isLegacyPublishedEventSink(symbol)) {
                    violations.add(symbol.getSimpleName() + " -> " + ownerType);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Binder package '" + source.packageName()
                        + "' injects legacy outward-work sinks into same-root IntentHandlers: "
                        + String.join(", ", violations)
                        + ". Domain writes must leave directly from the IntentHandler through the matching root *ApplicationService.")
                .build();
    }

    private static boolean isLegacyPublishedEventSink(Symbol.MethodSymbol symbol) {
        if ("onPublishedEventRequested".contentEquals(symbol.getSimpleName())) {
            return true;
        }
        return symbol.getParameters().stream()
                .map(parameter -> parameter.type == null ? "" : parameter.type.toString())
                .map(ViewArchitectureSupport::topLevelQualifiedTypeNameOf)
                .anyMatch(ViewArchitectureSupport::isTargetPublishedEventReference);
    }
}
