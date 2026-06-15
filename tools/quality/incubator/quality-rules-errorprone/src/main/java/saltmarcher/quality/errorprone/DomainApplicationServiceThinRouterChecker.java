package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.Modifier;

@BugPattern(
        name = "DomainApplicationServiceThinRouter",
        summary = "Root domain ApplicationService methods must stay thin command routers to exactly one UseCase call.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainApplicationServiceThinRouterChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern SAME_FEATURE_MODEL_CONCERN =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\..+");
    private static final Pattern SAME_FEATURE_REPOSITORY_CONCERN =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.[^.]+\\.repository\\..+");
    private static final Pattern SAME_FEATURE_PUBLISHED_MODEL =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.[^.]+Model$");
    private static final Pattern SAME_FEATURE_ROOT_USECASE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase$");
    private static final Pattern SAME_FEATURE_MODEL_USECASE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.[^.]+\\.usecase\\.[^.]+UseCase$");
    private static final Pattern SAME_FEATURE_MODEL_USECASE_OWNED =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.[^.]+\\.usecase\\.[^.]+UseCase(?:[.$].*)?$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        Matcher packageMatcher = ROOT_PACKAGE.matcher(DataArchitectureSupport.packageName(tree));
        if (!packageMatcher.matches()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        if (topLevelClass == null || !topLevelClass.getSimpleName().toString().endsWith("ApplicationService")) {
            return Description.NO_MATCH;
        }

        String feature = packageMatcher.group(1);
        List<String> violations = new ArrayList<>();
        collectForbiddenClassReferences(feature, tree, violations);
        collectPublicMethodRoutingViolations(feature, topLevelClass, violations);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Domain ApplicationService '" + feature
                        + "' is not a thin command router: " + String.join("; ", violations)
                        + ". Root services may read the boundary command, branch, and route to exactly one same-context UseCase call per public command method.")
                .build();
    }

    private static void collectForbiddenClassReferences(
            String feature,
            CompilationUnitTree tree,
            List<String> violations
    ) {
        Set<String> forbiddenReferences = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (isSameFeatureModelConcern(referencedType, feature)
                    || isSameFeatureRepositoryConcern(referencedType, feature)
                    || isSameFeaturePublishedModel(referencedType, feature)) {
                forbiddenReferences.add(referencedType);
            }
        }
        if (!forbiddenReferences.isEmpty()) {
            violations.add("references non-boundary domain role(s) "
                    + String.join(", ", forbiddenReferences));
        }
    }

    private static void collectPublicMethodRoutingViolations(
            String feature,
            ClassTree topLevelClass,
            List<String> violations
    ) {
        for (Tree member : topLevelClass.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
            if (methodSymbol == null
                    || methodSymbol.isConstructor()
                    || !methodSymbol.getModifiers().contains(Modifier.PUBLIC)) {
                continue;
            }
            MethodCallSummary calls = MethodCallSummary.collect(feature, methodTree);
            if (calls.useCaseCallCount() != 1) {
                violations.add("public method " + methodSymbol.getSimpleName()
                        + "() calls same-context UseCase methods " + calls.useCaseCallCount()
                        + " time(s)");
            }
            if (!calls.forbiddenCallOwners().isEmpty()) {
                violations.add("public method " + methodSymbol.getSimpleName()
                        + "() calls forbidden non-UseCase owner(s) "
                        + String.join(", ", calls.forbiddenCallOwners()));
            }
        }
    }

    private static boolean isSameFeatureModelConcern(String referencedType, String feature) {
        Matcher matcher = SAME_FEATURE_MODEL_CONCERN.matcher(referencedType);
        return matcher.matches()
                && feature.equals(matcher.group(1))
                && !isSameFeatureModelUseCaseOwned(referencedType, feature);
    }

    private static boolean isSameFeatureRepositoryConcern(String referencedType, String feature) {
        Matcher matcher = SAME_FEATURE_REPOSITORY_CONCERN.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    private static boolean isSameFeaturePublishedModel(String referencedType, String feature) {
        Matcher matcher = SAME_FEATURE_PUBLISHED_MODEL.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    private static boolean isSameFeatureUseCase(String referencedType, String feature) {
        Matcher rootMatcher = SAME_FEATURE_ROOT_USECASE.matcher(referencedType);
        if (rootMatcher.matches()) {
            return feature.equals(rootMatcher.group(1));
        }
        return isSameFeatureModelUseCase(referencedType, feature);
    }

    private static boolean isSameFeatureModelUseCase(String referencedType, String feature) {
        Matcher matcher = SAME_FEATURE_MODEL_USECASE.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    private static boolean isSameFeatureModelUseCaseOwned(String referencedType, String feature) {
        Matcher matcher = SAME_FEATURE_MODEL_USECASE_OWNED.matcher(referencedType);
        return matcher.matches() && feature.equals(matcher.group(1));
    }

    private record MethodCallSummary(int useCaseCallCount, Set<String> forbiddenCallOwners) {
        private static MethodCallSummary collect(String feature, MethodTree methodTree) {
            int[] useCaseCallCount = {0};
            Set<String> forbiddenCallOwners = new TreeSet<>();
            new TreeScanner<Void, Void>() {
                @Override
                public Void visitMethodInvocation(MethodInvocationTree invocationTree, Void unused) {
                    Symbol symbol = ASTHelpers.getSymbol(invocationTree);
                    String ownerName = ownerQualifiedName(symbol);
                    if (ownerName != null) {
                        if (isSameFeatureUseCase(ownerName, feature)) {
                            useCaseCallCount[0]++;
                        } else if (isSameFeatureModelConcern(ownerName, feature)
                                || isSameFeatureRepositoryConcern(ownerName, feature)
                                || isSameFeaturePublishedModel(ownerName, feature)) {
                            forbiddenCallOwners.add(ownerName);
                        }
                    }
                    return super.visitMethodInvocation(invocationTree, unused);
                }
            }.scan(methodTree, null);
            return new MethodCallSummary(useCaseCallCount[0], forbiddenCallOwners);
        }

        private static String ownerQualifiedName(Symbol symbol) {
            if (symbol != null && symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
                return classSymbol.getQualifiedName().toString();
            }
            return null;
        }
    }
}
