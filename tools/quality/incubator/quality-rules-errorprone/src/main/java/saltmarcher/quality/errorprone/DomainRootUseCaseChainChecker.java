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
        name = "DomainRootUseCaseNoRootUseCaseChains",
        summary = "Root domain UseCases must not depend on other root UseCases in the same context.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRootUseCaseChainChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern ROOT_USECASE_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application$");
    private static final Pattern SAME_FEATURE_ROOT_USECASE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application\\.[^.]+UseCase(?:[.$].*)?$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        Matcher packageMatcher = ROOT_USECASE_PACKAGE.matcher(DataArchitectureSupport.packageName(tree));
        if (!packageMatcher.matches()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = DomainRoleConcernSupport.topLevelClass(tree);
        if (topLevelClass == null || !topLevelClass.getSimpleName().toString().endsWith("UseCase")) {
            return Description.NO_MATCH;
        }

        String feature = packageMatcher.group(1);
        String ownType = DataArchitectureSupport.packageName(tree) + "." + topLevelClass.getSimpleName();
        Set<String> chainedRootUseCases = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            Matcher referenceMatcher = SAME_FEATURE_ROOT_USECASE.matcher(referencedType);
            if (referenceMatcher.matches()
                    && feature.equals(referenceMatcher.group(1))
                    && !referencedType.equals(ownType)
                    && !referencedType.startsWith(ownType + "$")
                    && !referencedType.startsWith(ownType + ".")) {
                chainedRootUseCases.add(referencedType);
            }
        }
        if (chainedRootUseCases.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass)
                .setMessage("Root domain UseCase '" + ownType
                        + "' depends on other same-context root UseCase(s): "
                        + String.join(", ", chainedRootUseCases)
                        + ". Root application/*UseCase files must not form orchestration chains; route from the ApplicationService to the owning operation or move one-family work under model/<family>/usecase/.")
                .build();
    }
}
