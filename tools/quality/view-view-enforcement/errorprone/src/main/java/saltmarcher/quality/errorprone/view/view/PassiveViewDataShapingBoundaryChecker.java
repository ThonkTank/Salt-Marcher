package saltmarcher.quality.errorprone.view.view;

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
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewDataShapingBoundary",
        summary = "Passive Views must not rebuild prepared render facts through local data-shaping APIs.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewDataShapingBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_STREAM_METHODS = Set.of(
            "collect",
            "distinct",
            "filter",
            "flatMap",
            "flatMapToDouble",
            "flatMapToInt",
            "flatMapToLong",
            "map",
            "mapMulti",
            "mapToDouble",
            "mapToInt",
            "mapToLong",
            "sorted",
            "toList");

    private static final Set<String> FORBIDDEN_COMPARATOR_METHODS = Set.of(
            "comparing",
            "comparingDouble",
            "comparingInt",
            "comparingLong",
            "naturalOrder",
            "reverseOrder");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        String qualifiedViewName = source.qualifiedTopLevelTypeName();
        MethodInvocationTree[] firstViolation = {null};
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                String methodName = symbol.getSimpleName().toString();
                if (isForbiddenDataShapingCall(ownerType, methodName)) {
                    violations.add(ownerType + "." + methodName + "()");
                    if (firstViolation[0] == null) {
                        firstViolation[0] = methodInvocationTree;
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstViolation[0] == null ? tree : firstViolation[0])
                .setMessage("Passive View '" + qualifiedViewName
                        + "' performs local data shaping through "
                        + String.join(", ", violations)
                        + ". Sorting, projection building, and observable collection synthesis belong in the owning model or upstream readback path, not in the View.")
                .build();
    }

    private static boolean isForbiddenDataShapingCall(String ownerType, String methodName) {
        if (ownerType == null || ownerType.isBlank()) {
            return false;
        }
        if ((ownerType.equals("java.util.stream.Stream")
                || ownerType.equals("java.util.stream.IntStream")
                || ownerType.equals("java.util.stream.LongStream")
                || ownerType.equals("java.util.stream.DoubleStream"))
                && FORBIDDEN_STREAM_METHODS.contains(methodName)) {
            return true;
        }
        if ("java.util.stream.Collectors".equals(ownerType)) {
            return true;
        }
        if ("java.util.Comparator".equals(ownerType) && FORBIDDEN_COMPARATOR_METHODS.contains(methodName)) {
            return true;
        }
        if ("java.util.Collections".equals(ownerType) && "sort".equals(methodName)) {
            return true;
        }
        return "javafx.collections.FXCollections".equals(ownerType) && methodName.startsWith("observable");
    }
}
