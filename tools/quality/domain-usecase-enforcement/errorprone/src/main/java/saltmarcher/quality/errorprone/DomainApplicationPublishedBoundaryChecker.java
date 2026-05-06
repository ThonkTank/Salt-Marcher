package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.TreeSet;
import java.util.regex.Pattern;

@BugPattern(
        name = "DomainApplicationNoSameContextPublishedDependency",
        summary = "Top-level domain application workflow types must not depend on their own published boundary carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainApplicationPublishedBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern DOMAIN_APPLICATION_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.application(\\..*)?$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        var matcher = DOMAIN_APPLICATION_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }

        String feature = matcher.group(1);
        TreeSet<String> forbiddenReferences = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("src.domain." + feature + ".published.")) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain application package '" + packageName
                        + "' depends on same-context published carrier type(s): "
                        + String.join(", ", forbiddenReferences)
                        + ". Top-level internal application files must stay on internal types; same-context published carriers belong only on the root inbound boundary and read-side published/*Model ownership.")
                .build();
    }
}
