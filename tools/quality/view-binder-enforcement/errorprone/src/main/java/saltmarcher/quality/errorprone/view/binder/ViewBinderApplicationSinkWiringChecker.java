package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewBinderApplicationSinkWiring",
        summary = "Binders may inject domain-write sinks into IntentHandlers only through same-root Consumer<PublishedEvent> seams.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewBinderApplicationSinkWiringChecker extends BugChecker
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
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                ViewArchitectureSupport.ViewTypeInfo ownerViewType = ViewArchitectureSupport.parseViewType(ownerType);
                if (ownerViewType == null || !"HANDLER".equals(ownerViewType.bucket())) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                if (!hasFunctionalInterfaceParameter(symbol)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String handlerPackageName = ViewArchitectureSupport.packageNameOfReferencedType(ownerType);
                if (!isExactPublishedEventSinkRegistration(symbol, handlerPackageName)) {
                    violations.add(symbol.getSimpleName() + " -> " + ownerType);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Binder package '" + sourcePackageName
                        + "' injects non-PublishedEvent callback seams into same-root IntentHandlers: "
                        + String.join(", ", violations)
                        + ". Domain-write sinks may enter the IntentHandler only as same-root Consumer<...PublishedEvent> seams.")
                .build();
    }

    private static boolean hasFunctionalInterfaceParameter(Symbol.MethodSymbol symbol) {
        if (symbol.getParameters().size() != 1) {
            return false;
        }
        return ViewArchitectureSupport.isFunctionalInterface(symbol.getParameters().getFirst().asType());
    }

    private static boolean isExactPublishedEventSinkRegistration(
            Symbol.MethodSymbol symbol,
            String handlerPackageName
    ) {
        if (!"onPublishedEventRequested".contentEquals(symbol.getSimpleName())
                || symbol.getParameters().size() != 1
                || symbol.getReturnType().getKind() != TypeKind.VOID) {
            return false;
        }
        TypeMirror parameterType = symbol.getParameters().getFirst().asType();
        return ViewArchitectureSupport.isConsumerOfSameRootPublishedEvent(parameterType, handlerPackageName);
    }
}
