package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
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
            Pattern.compile("^src\\.domain\\.([^.]+)\\.model\\.([^.]+)\\.(model|usecase)\\..+");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        DomainRoleConcernSupport.SourceRole sourceRole =
                DomainRoleConcernSupport.describeRole(tree, DomainRoleConcernSupport.Role.USECASE);
        if (sourceRole == null || sourceRole.family() != null || !sourceRole.topLevelQualifiedName().endsWith("UseCase")) {
            return Description.NO_MATCH;
        }

        Set<String> modelFamilies = referencedModelFamilies(sourceRole.feature(), tree);
        if (modelFamilies.size() >= 2) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Root domain UseCase '" + sourceRole.topLevelQualifiedName()
                        + "' is not justified as cross-model-family orchestration: referenced model families "
                        + modelFamilies
                        + ". Root application/*UseCase files must orchestrate at least two same-context model families; one-family work belongs in model/<family>/usecase/.")
                .build();
    }

    private static Set<String> referencedModelFamilies(String sourceFeature, CompilationUnitTree tree) {
        Set<String> modelFamilies = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            Matcher matcher = SAME_CONTEXT_MODEL_OR_USECASE_TYPE.matcher(referencedType);
            if (matcher.matches() && sourceFeature.equals(matcher.group(1))) {
                modelFamilies.add(matcher.group(2));
            }
        }
        return modelFamilies;
    }
}
