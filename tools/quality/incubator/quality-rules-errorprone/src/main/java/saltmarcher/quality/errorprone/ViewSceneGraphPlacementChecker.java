package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewSceneGraphPlacement",
        summary = "Assembly packages may only expose JavaFX Node as a shell boundary type; scene graph construction belongs in View packages.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewSceneGraphPlacementChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final String ALLOWED_NODE_BOUNDARY_TYPE = "javafx.scene.Node";

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!ViewArchitectureSupport.ASSEMBLY_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenJavafxReference(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Assembly package '" + packageName
                        + "' must keep JavaFX scene-graph construction in View/. Only "
                        + ALLOWED_NODE_BOUNDARY_TYPE
                        + " is allowed as a shell slot boundary type. References: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isForbiddenJavafxReference(String referencedType) {
        return referencedType.startsWith("javafx.") && !ALLOWED_NODE_BOUNDARY_TYPE.equals(referencedType);
    }
}
