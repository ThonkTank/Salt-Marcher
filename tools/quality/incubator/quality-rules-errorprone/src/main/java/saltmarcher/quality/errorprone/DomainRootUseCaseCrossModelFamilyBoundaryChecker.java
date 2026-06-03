package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.util.ASTHelpers;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@BugPattern(
        name = "DomainRootUseCaseCrossModelFamilyBoundary",
        summary = "Root domain UseCases are reserved for cross-model-family orchestration.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRootUseCaseCrossModelFamilyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern SAME_CONTEXT_MODEL_OR_USECASE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)(?:\\.(.*))?$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.USECASE);
        if (sourceRole == null || sourceRole.family() != null || !sourceRole.topLevelQualifiedName().endsWith("UseCase")) {
            return Description.NO_MATCH;
        }

        Set<String> modelFamilies = invokedModelFamilies(sourceRole.feature(), tree);
        if (modelFamilies.size() >= 2) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Root domain UseCase '" + sourceRole.topLevelQualifiedName()
                        + "' is not justified as cross-model-family orchestration: invoked model families "
                        + modelFamilies
                        + ". Root application/*UseCase files must orchestrate at least two same-context model families; one-family work belongs in model/<family>/usecase/.")
                .build();
    }

    private static Set<String> invokedModelFamilies(String sourceFeature, CompilationUnitTree tree) {
        Set<String> modelFamilies = new TreeSet<>();
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocationTree, Void unused) {
                addOwnerFamily(sourceFeature, ASTHelpers.getSymbol(invocationTree), modelFamilies);
                return super.visitMethodInvocation(invocationTree, unused);
            }

            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                addOwnerFamily(sourceFeature, ASTHelpers.getSymbol(newClassTree), modelFamilies);
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);
        return modelFamilies;
    }

    private static void addOwnerFamily(String sourceFeature, Symbol symbol, Set<String> modelFamilies) {
        if (!(symbol.owner instanceof Symbol.ClassSymbol ownerType)) {
            return;
        }
        Matcher matcher = SAME_CONTEXT_MODEL_OR_USECASE_TYPE.matcher(ownerType.getQualifiedName().toString());
        if (matcher.matches()
                && sourceFeature.equals(matcher.group(1))
                && (matcher.group(3) == null
                || matcher.group(3).startsWith("usecase.")
                || !isTechnicalNonUseCaseRole(matcher.group(3)))) {
            modelFamilies.add(matcher.group(2));
        }
    }

    private static boolean isTechnicalNonUseCaseRole(String suffix) {
        int separator = suffix.indexOf('.');
        String segment = separator < 0 ? suffix : suffix.substring(0, separator);
        return Set.of("helper", "constants", "port", "repository").contains(segment);
    }
}
