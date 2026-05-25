package saltmarcher.architecture.layering;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import javax.lang.model.element.Modifier;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class LayeringPassiveCarrierMirrorRules implements ArchitectureRule {

    private static final String RULE_ID = "layering-no-passive-carrier-shape-mirror-inside-feature-root";
    private static final Set<String> ACTIVE_VIEW_BUCKETS = Set.of("leftbartabs", "statetabs", "dropdowns");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            violations.add("src", RULE_ID,
                    "The layering passive-carrier mirror scan requires the JDK system compiler to parse source files.");
            return;
        }

        Map<String, List<CarrierType>> carriersByFeatureRoot = collectCarriersByFeatureRoot(context, compiler, violations);
        for (Map.Entry<String, List<CarrierType>> entry : carriersByFeatureRoot.entrySet()) {
            validateFeatureRoot(entry.getKey(), entry.getValue(), violations);
        }
    }

    private static Map<String, List<CarrierType>> collectCarriersByFeatureRoot(
            ArchitectureContext context,
            JavaCompiler compiler,
            ViolationSink violations
    ) {
        Map<String, List<CarrierType>> carriersByFeatureRoot = new TreeMap<>();
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null)) {
            for (SourceFile sourceFile : context.sourceFiles(violations)) {
                String featureRoot = featureRoot(sourceFile.relativeSegments());
                if (featureRoot == null) {
                    continue;
                }
                collectCarriersFromSourceFile(context, compiler, fileManager, sourceFile, featureRoot, carriersByFeatureRoot, violations);
            }
        } catch (IOException exception) {
            violations.add("src", RULE_ID,
                    "Could not close the layering passive-carrier mirror source scanner: " + exception.getMessage());
        }
        return carriersByFeatureRoot;
    }

    private static void collectCarriersFromSourceFile(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            SourceFile sourceFile,
            String featureRoot,
            Map<String, List<CarrierType>> carriersByFeatureRoot,
            ViolationSink violations
    ) {
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
                List<CarrierType> collected = new ArrayList<>();
                new CarrierCollector(sourceFile.relativePath(), featureRoot, unit).scan(unit, collected);
                carriersByFeatureRoot.computeIfAbsent(featureRoot, ignored -> new ArrayList<>()).addAll(collected);
            }
        } catch (IOException exception) {
            violations.add(sourceFile.relativePath(), RULE_ID,
                    "Could not parse source file for the passive-carrier mirror scan: " + exception.getMessage());
        }
    }

    private static void validateFeatureRoot(String featureRoot, List<CarrierType> carriers, ViolationSink violations) {
        if (carriers.size() < 2) {
            return;
        }

        FeatureCarrierIndex index = new FeatureCarrierIndex(carriers);
        Map<String, List<CarrierType>> carriersBySignature = new LinkedHashMap<>();
        for (CarrierType carrier : carriers.stream()
                .sorted(Comparator.comparing(CarrierType::relativePath).thenComparing(CarrierType::declaredName))
                .toList()) {
            String signature = index.signatureOf(carrier);
            carriersBySignature.computeIfAbsent(signature, ignored -> new ArrayList<>()).add(carrier);
        }

        for (List<CarrierType> group : carriersBySignature.values()) {
            if (group.size() < 2) {
                continue;
            }
            violations.add(featureRoot, RULE_ID, violationMessage(featureRoot, group));
        }
    }

    private static String violationMessage(String featureRoot, List<CarrierType> group) {
        String joinedTypes = group.stream()
                .sorted(Comparator.comparing(CarrierType::relativePath).thenComparing(CarrierType::declaredName))
                .map(carrier -> carrier.qualifiedName() + " [" + carrier.relativePath() + "]")
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
        return "Feature root '" + featureRoot
                + "' contains passive record/enum carrier mirrors with the same recursive shape: "
                + joinedTypes
                + ". Reuse one canonical passive carrier instead of maintaining isomorphic mirrors.";
    }

    private static String featureRoot(List<String> segments) {
        if (segments.size() < 3 || !"src".equals(segments.get(0))) {
            return null;
        }
        String layer = segments.get(1);
        if (("domain".equals(layer) || "data".equals(layer)) && segments.size() >= 3) {
            return String.join("/", segments.subList(0, 3));
        }
        if (!"view".equals(layer) || segments.size() < 5) {
            return null;
        }
        if (ACTIVE_VIEW_BUCKETS.contains(segments.get(2)) && segments.size() >= 5) {
            return String.join("/", segments.subList(0, 4));
        }
        if ("slotcontent".equals(segments.get(2)) && segments.size() >= 6) {
            return String.join("/", segments.subList(0, 5));
        }
        return null;
    }

    private static final class CarrierCollector extends TreeScanner<Void, List<CarrierType>> {

        private final String relativePath;
        private final String featureRoot;
        private final String packageName;
        private final Deque<String> nesting = new ArrayDeque<>();

        private CarrierCollector(String relativePath, String featureRoot, CompilationUnitTree unit) {
            this.relativePath = relativePath;
            this.featureRoot = featureRoot;
            this.packageName = unit.getPackageName() == null ? "" : unit.getPackageName().toString();
        }

        @Override
        public Void visitClass(ClassTree node, List<CarrierType> carriers) {
            String simpleName = node.getSimpleName().toString();
            if (simpleName.isBlank()) {
                return super.visitClass(node, carriers);
            }

            nesting.addLast(simpleName);
            try {
                if (isBoundaryCommandCarrier()) {
                    return super.visitClass(node, carriers);
                }
                if (node.getKind() == Tree.Kind.RECORD) {
                    carriers.add(recordType(node));
                } else if (node.getKind() == Tree.Kind.ENUM) {
                    carriers.add(enumType(node));
                }
                return super.visitClass(node, carriers);
            } finally {
                nesting.removeLast();
            }
        }

        private CarrierType recordType(ClassTree node) {
            List<RecordComponent> components = new ArrayList<>();
            for (Tree member : node.getMembers()) {
                if (!(member instanceof VariableTree variable) || !isRecordComponent(variable)) {
                    if (!components.isEmpty()) {
                        break;
                    }
                    continue;
                }
                String typeText = variable.getType() == null ? "" : variable.getType().toString();
                components.add(new RecordComponent(variable.getName().toString(), typeText));
            }
            return new CarrierType(
                    relativePath,
                    featureRoot,
                    packageName,
                    declaredName(),
                    simpleName(),
                    CarrierKind.RECORD,
                    components,
                    List.of());
        }

        private CarrierType enumType(ClassTree node) {
            List<String> constants = new ArrayList<>();
            for (Tree member : node.getMembers()) {
                if (!(member instanceof VariableTree variable)) {
                    continue;
                }
                if (isEnumConstant(node, variable)) {
                    constants.add(variable.getName().toString());
                }
            }
            return new CarrierType(
                    relativePath,
                    featureRoot,
                    packageName,
                    declaredName(),
                    simpleName(),
                    CarrierKind.ENUM,
                    List.of(),
                    constants);
        }

        private String declaredName() {
            return String.join(".", nesting);
        }

        private String simpleName() {
            return nesting.getLast();
        }

        private boolean isBoundaryCommandCarrier() {
            return nesting.size() == 1
                    && simpleName().endsWith("Command")
                    && relativePath.contains("/published/");
        }

        private static boolean isEnumConstant(ClassTree enumTree, VariableTree variable) {
            if (!(variable.getInitializer() instanceof NewClassTree)) {
                return false;
            }
            if (!variable.getModifiers().getFlags().containsAll(Set.of(Modifier.PUBLIC, Modifier.STATIC, Modifier.FINAL))) {
                return false;
            }
            return variable.getType() != null
                    && enumTree.getSimpleName().contentEquals(variable.getType().toString());
        }

        private static boolean isRecordComponent(VariableTree variable) {
            return variable.getInitializer() == null
                    && variable.getType() != null
                    && variable.getModifiers().getFlags().containsAll(Set.of(Modifier.PRIVATE, Modifier.FINAL));
        }
    }

    private static final class FeatureCarrierIndex {

        private final Map<String, CarrierType> carriersById;
        private final Map<String, String> aliasToCarrierId;
        private final Map<String, String> signatures = new LinkedHashMap<>();
        private final Set<String> resolving = new LinkedHashSet<>();

        private FeatureCarrierIndex(List<CarrierType> carriers) {
            this.carriersById = new LinkedHashMap<>();
            Map<String, Set<String>> aliasCandidates = new LinkedHashMap<>();
            for (CarrierType carrier : carriers) {
                carriersById.put(carrier.id(), carrier);
                registerAlias(aliasCandidates, carrier.simpleName(), carrier.id());
                registerAlias(aliasCandidates, carrier.declaredName(), carrier.id());
                registerAlias(aliasCandidates, carrier.qualifiedName(), carrier.id());
            }
            this.aliasToCarrierId = new LinkedHashMap<>();
            for (Map.Entry<String, Set<String>> entry : aliasCandidates.entrySet()) {
                if (entry.getValue().size() == 1) {
                    aliasToCarrierId.put(entry.getKey(), entry.getValue().iterator().next());
                }
            }
        }

        private String signatureOf(CarrierType carrier) {
            String cached = signatures.get(carrier.id());
            if (cached != null) {
                return cached;
            }
            if (!resolving.add(carrier.id())) {
                return carrier.kind() == CarrierKind.RECORD ? "record{SELF}" : "enum{SELF}";
            }
            String signature;
            if (carrier.kind() == CarrierKind.ENUM) {
                signature = "enum(" + String.join(",", carrier.enumConstants()) + ")";
            } else {
                String components = carrier.recordComponents().stream()
                        .map(component -> component.name() + ":" + normalizeType(component.typeText()))
                        .reduce((left, right) -> left + "," + right)
                        .orElse("");
                signature = "record(" + components + ")";
            }
            resolving.remove(carrier.id());
            signatures.put(carrier.id(), signature);
            return signature;
        }

        private String normalizeType(String typeText) {
            StringBuilder normalized = new StringBuilder();
            StringBuilder token = new StringBuilder();
            for (int index = 0; index < typeText.length(); index++) {
                char current = typeText.charAt(index);
                if (Character.isWhitespace(current)) {
                    appendNormalizedToken(token, normalized);
                    continue;
                }
                if (Character.isJavaIdentifierPart(current) || current == '.') {
                    token.append(current);
                    continue;
                }
                appendNormalizedToken(token, normalized);
                normalized.append(current);
            }
            appendNormalizedToken(token, normalized);
            return normalized.toString();
        }

        private void appendNormalizedToken(StringBuilder token, StringBuilder normalized) {
            if (token.isEmpty()) {
                return;
            }
            String rawToken = token.toString();
            token.setLength(0);
            String carrierId = aliasToCarrierId.get(rawToken);
            if (carrierId == null) {
                normalized.append(rawToken);
                return;
            }
            CarrierType referenced = carriersById.get(carrierId);
            if (referenced == null) {
                normalized.append(rawToken);
                return;
            }
            normalized.append('{').append(signatureOf(referenced)).append('}');
        }

        private static void registerAlias(Map<String, Set<String>> aliasCandidates, String alias, String carrierId) {
            if (alias == null || alias.isBlank()) {
                return;
            }
            aliasCandidates.computeIfAbsent(alias, ignored -> new TreeSet<>()).add(carrierId);
        }
    }

    private enum CarrierKind {
        RECORD,
        ENUM
    }

    private record CarrierType(
            String relativePath,
            String featureRoot,
            String packageName,
            String declaredName,
            String simpleName,
            CarrierKind kind,
            List<RecordComponent> recordComponents,
            List<String> enumConstants
    ) {
        private String id() {
            return relativePath + "#" + declaredName;
        }

        private String qualifiedName() {
            return packageName.isBlank() ? declaredName : packageName + "." + declaredName;
        }
    }

    private record RecordComponent(String name, String typeText) {
    }
}
