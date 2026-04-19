package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewRootDelegation",
        summary = "Old component-local view roots are forbidden; shell-facing view wiring belongs in src.view.models.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRootDelegationChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!ViewArchitectureSupport.LEGACY_VIEW_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType)) {
                violations.add("reference -> " + referencedType);
            }
        }
        violations.add("package -> " + packageName);

        return buildDescription(tree)
                .setMessage("Legacy view package '" + packageName
                        + "' violates the shell cockpit tab-model topology. Move contribution models to src.view.models and passive panels to src.view.views. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType) {
        return referencedType.startsWith("shell.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")
                || ViewArchitectureSupport.isLegacyViewReference(referencedType);
    }
}
