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
        name = "ViewInspectorEntryDependencyBoundary",
        summary = "InspectorEntry adapters may depend only on their local detail slotcontent, InspectorEntrySpec, and published domain carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInspectorEntryDependencyBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (source.role() != ViewRole.INSPECTOR_ENTRY) {
            return Description.NO_MATCH;
        }

        String packageName = source.packageName();
        Set<String> forbiddenReferences = collectForbiddenReferences(tree, state, packageName);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("InspectorEntry package '" + packageName
                        + "' violates InspectorEntry dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static Set<String> collectForbiddenReferences(
            CompilationUnitTree tree,
            VisitorState state,
            String sourcePackageName
    ) {
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        if (!sourcePackageName.matches("^src\\.view\\.slotcontent\\.details\\.[^.]+$")) {
            forbiddenReferences.add(sourcePackageName + " (expected src.view.slotcontent.details.<entry>)");
        }
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbidden(referencedType, sourcePackageName, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbidden(String referencedType, String sourcePackageName, String sourceText) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if ("java.util.concurrent.Callable".equals(referencedType)
                && !sourceText.contains("Callable")
                && !sourceText.contains("java.util.concurrent")) {
            return false;
        }
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            return !referencedType.equals("javafx.scene.Node");
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewRolePolicy.isAllowedInspectorShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (!ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)) {
            return true;
        }
        if (!"details".equals(viewType.component())) {
            return true;
        }
        String topLevelQualifiedTypeName = ViewArchitectureSupport.topLevelQualifiedTypeNameOf(referencedType);
        if ("VIEW".equals(viewType.bucket())) {
            return !topLevelQualifiedTypeName.endsWith("View");
        }
        if ("INSPECTOR_ENTRY".equals(viewType.bucket())) {
            return false;
        }
        return !"MODEL".equals(viewType.bucket()) || !topLevelQualifiedTypeName.endsWith("ContentModel");
    }

    private static String sourceText(CompilationUnitTree tree, VisitorState state) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        try {
            String sourceText = state.getSourceForNode(tree);
            return sourceText == null ? "" : sourceText;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}
