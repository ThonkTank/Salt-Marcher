package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewModelFrameworkIndependence",
        summary = "ViewModel packages may use JavaFX beans/collections but not JavaFX UI, shell, data, or view dependencies.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewModelFrameworkIndependenceChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        var matcher = ViewArchitectureSupport.VIEW_MODEL_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        String component = matcher.group(1);

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            collectForbiddenReferences(referencedType, component, forbiddenReferences);
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' violates MVVM ViewModel independence via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static void collectForbiddenReferences(String qualifiedName, String component, Set<String> forbiddenReferences) {
        if (qualifiedName == null || qualifiedName.isBlank()) {
            return;
        }
        if (isForbidden(qualifiedName, component)) {
            forbiddenReferences.add(qualifiedName);
        }
    }

    private static boolean isForbidden(String referencedType, String component) {
        if (referencedType.startsWith("javafx.")) {
            return !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedDomainBoundary(referencedType);
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (viewType.component().equals(component)) {
            return !"ViewModel".equals(viewType.bucket());
        }
        return true;
    }
}
