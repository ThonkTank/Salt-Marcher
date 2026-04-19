package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewRestrictedDependencies",
        summary = "View packages may depend only on JavaFX UI APIs, own View/ViewModel, and JDK types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRestrictedDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        var matcher = ViewArchitectureSupport.VIEW_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        String component = matcher.group(1);

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, component)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("View package '" + packageName
                        + "' violates MVVM dependency rules via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType, String component) {
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (viewType.component().equals(component)) {
            return !"View".equals(viewType.bucket()) && !"ViewModel".equals(viewType.bucket());
        }
        return true;
    }
}
