package saltmarcher.quality.errorprone.view.publishedevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewPublishedEventProducerOwnership",
        summary = "Only the co-located IntentHandler may build and publish top-level PublishedEvent carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewPublishedEventProducerOwnershipChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        if (!sourcePackageName.startsWith("src.view.")) {
            return Description.NO_MATCH;
        }

        boolean allowTopLevelPublishedEventProduction =
                ViewArchitectureSupport.isIntentHandlerSource(tree) || ViewArchitectureSupport.isPublishedEventSource(tree);
        boolean allowPublishedEventPublication = ViewArchitectureSupport.isIntentHandlerSource(tree);
        Set<String> violations = new LinkedHashSet<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(newClassTree);
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!allowTopLevelPublishedEventProduction
                        && ViewArchitectureSupport.isTopLevelPublishedEventReference(ownerType)
                        && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, ownerType)) {
                    violations.add("constructs " + ownerType);
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }

                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (!allowTopLevelPublishedEventProduction
                        && ownerType != null
                        && symbol.getModifiers().contains(Modifier.STATIC)
                        && ViewArchitectureSupport.isTopLevelPublishedEventReference(ownerType)
                        && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, ownerType)) {
                    violations.add("invokes static PublishedEvent factory " + ownerType + "." + symbol.getSimpleName());
                }

                if (!allowPublishedEventPublication
                        && "accept".contentEquals(symbol.getSimpleName())
                        && consumesSameRootPublishedEvent(methodInvocationTree, sourcePackageName)) {
                    violations.add("publishes same-root PublishedEvent via Consumer.accept");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Only the co-located IntentHandler may build and publish top-level PublishedEvent carriers. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean consumesSameRootPublishedEvent(
            MethodInvocationTree methodInvocationTree,
            String sourcePackageName
    ) {
        if (!(methodInvocationTree.getMethodSelect() instanceof MemberSelectTree memberSelectTree)) {
            return false;
        }
        TypeMirror receiverType = ASTHelpers.getType(memberSelectTree.getExpression());
        return ViewArchitectureSupport.isConsumerOfSameRootPublishedEvent(receiverType, sourcePackageName);
    }
}
