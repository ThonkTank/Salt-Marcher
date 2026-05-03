package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.LambdaExpressionTree;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreeScanner;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderPublishedEventSinkEffect",
        summary = "onPublishedEventRequested sinks may only translate PublishedEvents into domain work, not direct view/model/shell effects.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderPublishedEventSinkEffectChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isBinderSource(tree)) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null || !"onPublishedEventRequested".contentEquals(symbol.getSimpleName())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (!methodInvocationTree.getArguments().isEmpty()) {
                    violations.addAll(inspectSinkCallback(methodInvocationTree.getArguments().getFirst()));
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' performs direct view/model/shell effects inside onPublishedEventRequested(...) sinks: "
                        + String.join(", ", violations)
                        + ". PublishedEvent sinks may only translate events into domain work; local UI effects belong in the local ContributionModel/ContentModel cycle.")
                .build();
    }

    private static Set<String> inspectSinkCallback(ExpressionTree callback) {
        Set<String> violations = new LinkedHashSet<>();
        if (callback instanceof MemberReferenceTree memberReferenceTree) {
            violations.add("method reference sink " + memberReferenceTree.getName());
            return violations;
        }
        if (!(callback instanceof LambdaExpressionTree lambdaExpressionTree)) {
            return violations;
        }
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                if (referencesForbiddenSinkSurface(methodInvocationTree)) {
                    Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                    violations.add(renderInvocation(symbol));
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(lambdaExpressionTree.getBody(), null);
        return violations;
    }

    private static boolean referencesForbiddenSinkSurface(MethodInvocationTree methodInvocationTree) {
        if (hasForbiddenSurfaceType(ASTHelpers.getType(methodInvocationTree.getMethodSelect()))) {
            return true;
        }
        Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
        if (hasForbiddenSurfaceType(symbol == null || symbol.owner == null ? null : symbol.owner.type)) {
            return true;
        }
        for (ExpressionTree argument : methodInvocationTree.getArguments()) {
            if (hasForbiddenSurfaceType(ASTHelpers.getType(argument))) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasForbiddenSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        for (String referencedType : referencedTypes) {
            if (referencedType.startsWith("shell.")
                    || ViewArchitectureSupport.isTargetPanelViewReference(referencedType)
                    || ViewArchitectureSupport.isTargetViewModelReference(referencedType)
                    || ViewArchitectureSupport.isDetailEntryReference(referencedType)) {
                return true;
            }
        }
        return false;
    }

    private static String renderInvocation(Symbol.MethodSymbol symbol) {
        if (symbol == null) {
            return "unknown invocation";
        }
        String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
        return (ownerType == null || ownerType.isBlank() ? "<unknown>" : ownerType)
                + "#" + symbol.getSimpleName();
    }
}
