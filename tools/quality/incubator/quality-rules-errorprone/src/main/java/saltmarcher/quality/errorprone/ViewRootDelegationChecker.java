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
        summary = "Root view entrypoints are the only shell-facing MVVM composition adapters.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRootDelegationChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        var matcher = ViewArchitectureSupport.ROOT_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        String component = matcher.group(1);

        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, component)) {
                violations.add("reference -> " + referencedType);
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Root package '" + packageName
                        + "' must stay the shell-facing MVVM composition adapter. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType, String component) {
        if (referencedType.startsWith("javafx.")) {
            return !ViewArchitectureSupport.isAllowedRootJavafxType(referencedType);
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedDomainBoundary(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewArchitectureSupport.isAllowedRootShellType(referencedType);
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (ViewArchitectureSupport.isDeclaredSharedApi(viewType)) {
            return false;
        }
        if (viewType.component().equals(component)) {
            return !"ROOT".equals(viewType.bucket())
                    && !"View".equals(viewType.bucket())
                    && !"ViewModel".equals(viewType.bucket())
                    && !ViewArchitectureSupport.isDeclaredSharedApi(viewType);
        }
        return !ViewArchitectureSupport.isDeclaredSharedApi(viewType);
    }
}
