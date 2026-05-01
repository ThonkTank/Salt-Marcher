package saltmarcher.quality.errorprone.data.servicecontribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;

@BugPattern(
        name = "DataServiceContributionShellApiAllowlist",
        summary = "Data ServiceContribution roots may use only their documented shell runtime seam subset.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataServiceContributionShellApiAllowlistChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ServiceContribution",
            "shell.api.ServiceRegistry");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        Matcher rootMatcher = DataServiceContributionArchitectureSupport.DATA_ROOT_PACKAGE.matcher(
                DataServiceContributionArchitectureSupport.packageName(tree));
        if (!rootMatcher.matches()) {
            return Description.NO_MATCH;
        }

        String packageName = rootMatcher.group();
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : DataServiceContributionArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.host.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("shell.api.")
                    && !isAllowedShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Data ServiceContribution package '" + packageName
                        + "' references shell types outside its allowed shell runtime subset: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isAllowedShellType(String referencedType) {
        if (ALLOWED_SHELL_TYPES.contains(referencedType)) {
            return true;
        }
        for (String allowedType : ALLOWED_SHELL_TYPES) {
            if (referencedType.startsWith(allowedType + "$")) {
                return true;
            }
        }
        return false;
    }
}
