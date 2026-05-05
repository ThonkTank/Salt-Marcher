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
        summary = "Domain application use cases must not depend on their own published boundary carriers.",
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
        if (!tree.getSourceFile().getName().endsWith("UseCase.java")) {
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
                        + ". Translate published input/output in the root ApplicationService before delegating to application use cases.")
                .build();
    }
}
