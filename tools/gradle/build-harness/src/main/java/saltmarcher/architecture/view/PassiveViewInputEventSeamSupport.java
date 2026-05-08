package saltmarcher.architecture.view;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ParameterizedTypeTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import javax.lang.model.element.Modifier;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class PassiveViewInputEventSeamSupport {

    private static final String RULE_ID = "view-viewinputevent-source-parse";

    private PassiveViewInputEventSeamSupport() {
    }

    public static List<InteractivePassiveView> scan(
            ArchitectureContext context,
            List<ViewSourceDescriptor> sources,
            ViolationSink violations
    ) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            violations.add("src/view", RULE_ID,
                    "The ViewInputEvent topology reverse scan requires the JDK system compiler to parse passive View sources.");
            return List.of();
        }

        List<InteractivePassiveView> interactiveViews = new ArrayList<>();
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null)) {
            for (ViewSourceDescriptor source : sources) {
                SourceFile sourceFile = source.sourceFile();
                if (source.role() != ViewRole.VIEW || !sourceFile.content().contains("onViewInputEvent")) {
                    continue;
                }
                scanSourceFile(context, compiler, fileManager, source, interactiveViews, violations);
            }
        } catch (IOException exception) {
            violations.add("src/view", RULE_ID,
                    "Could not close the passive View input seam scanner: " + exception.getMessage());
        }
        return List.copyOf(interactiveViews);
    }

    private static void scanSourceFile(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            ViewSourceDescriptor source,
            List<InteractivePassiveView> interactiveViews,
            ViolationSink violations
    ) {
        SourceFile sourceFile = source.sourceFile();
        Path absolutePath = context.repoRoot().resolve(sourceFile.relativePath()).normalize().toAbsolutePath();
        JavacTask task = (JavacTask) compiler.getTask(
                null,
                fileManager,
                null,
                List.of("--release", "21", "-proc:none"),
                null,
                fileManager.getJavaFileObjects(absolutePath.toFile()));
        try {
            for (CompilationUnitTree unit : task.parse()) {
                new InteractiveViewCollector(source).scan(unit, interactiveViews);
            }
        } catch (IOException exception) {
            violations.add(sourceFile.relativePath(), RULE_ID,
                    "Could not parse passive View source for the input seam scan: " + exception.getMessage());
        }
    }

    private static final class InteractiveViewCollector extends TreeScanner<Void, List<InteractivePassiveView>> {

        private final SourceFile sourceFile;
        private final String viewStem;
        private boolean topLevelVisited;

        private InteractiveViewCollector(ViewSourceDescriptor source) {
            this.sourceFile = source.sourceFile();
            this.viewStem = source.stem();
        }

        @Override
        public Void visitClass(ClassTree node, List<InteractivePassiveView> interactiveViews) {
            if (topLevelVisited) {
                return null;
            }
            topLevelVisited = true;
            String viewSimpleName = sourceFile.fileName().replaceFirst("\\.java$", "");
            for (Tree member : node.getMembers()) {
                if (!(member instanceof MethodTree methodTree)) {
                    continue;
                }
                InteractivePassiveView interactiveView = interactiveView(methodTree, sourceFile, viewStem, viewSimpleName);
                if (interactiveView != null) {
                    interactiveViews.add(interactiveView);
                }
            }
            return null;
        }
    }

    private static InteractivePassiveView interactiveView(
            MethodTree methodTree,
            SourceFile sourceFile,
            String viewStem,
            String viewSimpleName
    ) {
        if (!"onViewInputEvent".contentEquals(methodTree.getName())
                || methodTree.getModifiers().getFlags().contains(Modifier.PRIVATE)) {
            return null;
        }
        return new InteractivePassiveView(sourceFile, viewStem, viewSimpleName, declaredEventSimpleName(methodTree));
    }

    private static String declaredEventSimpleName(MethodTree methodTree) {
        if (methodTree.getParameters().size() != 1) {
            return null;
        }
        Tree returnType = methodTree.getReturnType();
        if (returnType == null || !"void".equals(returnType.toString())) {
            return null;
        }
        Tree parameterType = methodTree.getParameters().getFirst().getType();
        if (!(parameterType instanceof ParameterizedTypeTree parameterizedTypeTree)
                || !isConsumerType(parameterizedTypeTree.getType())
                || parameterizedTypeTree.getTypeArguments().size() != 1) {
            return null;
        }
        return simpleTypeName(parameterizedTypeTree.getTypeArguments().getFirst());
    }

    private static boolean isConsumerType(Tree tree) {
        String typeText = tree.toString().trim();
        return "Consumer".equals(typeText) || typeText.endsWith(".Consumer");
    }

    private static String simpleTypeName(Tree tree) {
        String typeText = tree.toString().trim().replaceFirst("<.*$", "");
        int separator = Math.max(typeText.lastIndexOf('.'), typeText.lastIndexOf('$'));
        return separator >= 0 ? typeText.substring(separator + 1) : typeText;
    }

    public record InteractivePassiveView(
            SourceFile sourceFile,
            String viewStem,
            String viewSimpleName,
            String declaredEventSimpleName
    ) {
        public String source() {
            return sourceFile.relativePath();
        }

        public String expectedViewInputEventSimpleName() {
            return viewSimpleName + "InputEvent";
        }
    }
}
