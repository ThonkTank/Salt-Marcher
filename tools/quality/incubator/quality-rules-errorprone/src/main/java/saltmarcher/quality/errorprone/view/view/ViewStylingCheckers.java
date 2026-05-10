package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

public final class ViewStylingCheckers {

    private static final Set<String> FORBIDDEN_CONSTRUCTED_TYPES = Set.of(
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
            "javafx.scene.paint.LinearGradient",
            "javafx.scene.paint.RadialGradient",
            "javafx.scene.paint.Stop",
            "javafx.scene.text.Font");
    private static final Set<String> FORBIDDEN_STATIC_VALUE_TYPES = Set.of(
            "javafx.scene.layout.Background",
            "javafx.scene.layout.Border",
            "javafx.scene.paint.Color",
            "javafx.scene.paint.Paint",
            "javafx.scene.text.Font");
    private static final Set<String> FORBIDDEN_COLOR_FACTORY_METHODS = Set.of("color", "gray", "grayRgb", "hsb", "rgb", "web");
    private static final Set<String> FORBIDDEN_PAINT_FACTORY_METHODS = Set.of("valueOf");
    private static final Set<String> FORBIDDEN_FONT_FACTORY_METHODS = Set.of("font", "loadFont");
    private static final Set<String> DIRECT_RENDER_EXCEPTION_TYPES = Set.of(
            "src.view.slotcontent.primitives.mapcanvas.MapCanvasView", "src.view.slotcontent.main.dungeonmap.DungeonMapView");

    private ViewStylingCheckers() {}

    @BugPattern(
            name = "ViewProgrammaticStyling",
            summary = "Visual style values must come from centralized stylesheets outside the documented passive-View direct-render exception.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewProgrammaticStylingChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!isTrackedSourcePackage(source.packageName()) || source.isPassiveViewSource()) {
                return Description.NO_MATCH;
            }

            Set<String> violations = collectViolations(tree);
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return buildDescription(tree)
                    .setMessage("Package '" + source.packageName()
                            + "' defines visual style values outside centralized resources/salt-marcher.css and outside the dedicated passive-View direct-render exception. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    @BugPattern(
            name = "ViewDirectRenderStylingPlacement",
            summary = "Passive views may host local JavaFX style values only inside the documented direct-render exception.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewDirectRenderStylingPlacementChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!source.isPassiveViewSource()) {
                return Description.NO_MATCH;
            }

            Set<String> violations = collectViolations(tree);
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            if (DIRECT_RENDER_EXCEPTION_TYPES.contains(source.qualifiedTopLevelTypeName())) {
                return Description.NO_MATCH;
            }

            return buildDescription(tree)
                    .setMessage("Passive View '" + source.qualifiedTopLevelTypeName()
                            + "' defines local JavaFX style values outside the documented direct-render exception. Only "
                            + String.join(", ", DIRECT_RENDER_EXCEPTION_TYPES)
                            + " may currently host direct-render styling code. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    private static Set<String> collectViolations(CompilationUnitTree tree) {
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(newClassTree);
                if (symbol != null) {
                    String typeName = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    if (FORBIDDEN_CONSTRUCTED_TYPES.contains(typeName)) {
                        violations.add("new style value -> " + typeName);
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (isForbiddenFactory(owner, methodName)) {
                        violations.add("local style factory -> " + owner + "." + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }

            @Override
            public Void visitVariable(VariableTree variableTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(variableTree);
                if (symbol instanceof Symbol.VarSymbol varSymbol
                        && varSymbol.isStatic()
                        && FORBIDDEN_STATIC_VALUE_TYPES.contains(typeName(varSymbol))) {
                    violations.add("static style value -> " + typeName(varSymbol));
                }
                return super.visitVariable(variableTree, unused);
            }
        }.scan(tree, null);
        return violations;
    }

    private static boolean isForbiddenFactory(String owner, String methodName) {
        return ("javafx.scene.paint.Color".equals(owner) && FORBIDDEN_COLOR_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.paint.Paint".equals(owner) && FORBIDDEN_PAINT_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.text.Font".equals(owner) && FORBIDDEN_FONT_FACTORY_METHODS.contains(methodName));
    }

    private static String typeName(Symbol.VarSymbol symbol) { return symbol.type == null || symbol.type.tsym == null ? "" : symbol.type.tsym.getQualifiedName().toString(); }

    private static boolean isTrackedSourcePackage(String packageName) {
        return packageName.equals("bootstrap") || packageName.startsWith("bootstrap.")
                || packageName.equals("shell") || packageName.startsWith("shell.")
                || packageName.equals("src") || packageName.startsWith("src.");
    }
}
