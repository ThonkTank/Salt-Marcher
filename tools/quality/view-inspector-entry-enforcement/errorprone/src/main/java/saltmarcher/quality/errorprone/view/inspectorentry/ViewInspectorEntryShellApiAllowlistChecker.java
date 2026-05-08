package saltmarcher.quality.errorprone.view.inspectorentry;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRolePolicy;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewInspectorEntryShellApiAllowlist",
        summary = "InspectorEntry adapters may use only shell.api.InspectorEntrySpec from the shell boundary.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInspectorEntryShellApiAllowlistChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (source.role() != ViewRole.INSPECTOR_ENTRY) {
            return Description.NO_MATCH;
        }

        String packageName = source.packageName();
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.") && !ViewRolePolicy.isAllowedInspectorShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("InspectorEntry package '" + packageName
                        + "' references shell types outside its allowed shell contract subset: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
