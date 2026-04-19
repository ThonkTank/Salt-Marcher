package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewProgrammaticStyling",
        summary = "Visual styling must stay in centralized stylesheets outside the documented canvas-rendering exception.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewProgrammaticStylingChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_TYPES = Set.of(
            "javafx.scene.canvas.Canvas",
            "javafx.scene.canvas.GraphicsContext",
            "javafx.scene.layout.Background",
            "javafx.scene.layout.BackgroundFill",
            "javafx.scene.layout.BackgroundImage",
            "javafx.scene.layout.BackgroundPosition",
            "javafx.scene.layout.BackgroundRepeat",
            "javafx.scene.layout.BackgroundSize",
            "javafx.scene.layout.Border",
            "javafx.scene.layout.BorderImage",
            "javafx.scene.layout.BorderStroke",
            "javafx.scene.layout.BorderStrokeStyle",
            "javafx.scene.layout.BorderWidths",
            "javafx.scene.paint.Color",
            "javafx.scene.paint.CycleMethod",
            "javafx.scene.paint.LinearGradient",
            "javafx.scene.paint.Paint",
            "javafx.scene.paint.RadialGradient",
            "javafx.scene.paint.Stop",
            "javafx.scene.text.Font",
            "javafx.scene.text.FontPosture",
            "javafx.scene.text.FontWeight"
    );

    private static final Set<String> FORBIDDEN_METHODS = Set.of(
            "setBackground",
            "setBorder",
            "setFill",
            "setFont",
            "setStroke",
            "setStrokeDashOffset",
            "setStrokeLineCap",
            "setStrokeLineJoin",
            "setStrokeMiterLimit",
            "setStrokeType",
            "setStrokeWidth",
            "setTextFill"
    );

    private static final Set<String> FORBIDDEN_GRAPHICS_CONTEXT_METHODS = Set.of(
            "setFill",
            "setStroke",
            "setFont"
    );

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!isTrackedSourcePackage(packageName) || isAllowedCanvasRenderingPackage(packageName)) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (FORBIDDEN_TYPES.contains(referencedType)) {
                violations.add("type -> " + referencedType);
            }
        }

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (FORBIDDEN_METHODS.contains(methodName)
                            && owner != null
                            && owner.startsWith("javafx.")) {
                        violations.add("method -> " + owner + "." + methodName + "()");
                    }
                    if ("javafx.scene.canvas.GraphicsContext".equals(owner)
                            && FORBIDDEN_GRAPHICS_CONTEXT_METHODS.contains(methodName)) {
                        violations.add("canvas -> " + owner + "." + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' uses programmatic visual styling outside the centralized stylesheet model. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isTrackedSourcePackage(String packageName) {
        return packageName.equals("bootstrap")
                || packageName.startsWith("bootstrap.")
                || packageName.equals("shell")
                || packageName.startsWith("shell.")
                || packageName.equals("src")
                || packageName.startsWith("src.");
    }

    private static boolean isAllowedCanvasRenderingPackage(String packageName) {
        return packageName.equals("src.view.mapshared.View")
                || packageName.startsWith("src.view.mapshared.View.");
    }
}
