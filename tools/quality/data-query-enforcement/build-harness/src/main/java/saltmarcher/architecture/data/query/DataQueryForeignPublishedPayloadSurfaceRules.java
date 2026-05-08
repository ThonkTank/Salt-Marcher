package saltmarcher.architecture.data.query;

import com.sun.source.tree.BlockTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.ImportTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.tree.StatementTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.TypeCastTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreePathScanner;
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
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.Modifier;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DataQueryForeignPublishedPayloadSurfaceRules implements ArchitectureRule {

    private static final String RULE_ID = "data-query-no-overbroad-foreign-published-payload-surface";
    private static final Pattern DOMAIN_PUBLISHED_PATH =
            Pattern.compile("^src/domain/([^.]+)/published/.*\\.java$");
    private static final Pattern DATA_QUERY_PATH =
            Pattern.compile("^src/data/([^.]+)/query/.*\\.java$");
    private static final Set<String> NON_PAYLOAD_SUFFIXES = Set.of("Command", "Model", "Result", "Status");
    private static final Set<String> OBJECT_METHODS = Set.of("toString", "hashCode", "equals");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            violations.add("src", RULE_ID,
                    "The data query foreign published payload surface scan requires the JDK system compiler to parse source files.");
            return;
        }

        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null)) {
            Map<String, CarrierMetadata> carriers = collectPublishedCarriers(context, compiler, fileManager, violations);
            Map<String, CarrierUsage> usages = collectQueryUsages(context, compiler, fileManager, carriers, violations);
            validatePayloadSurfaces(carriers, usages, violations);
        } catch (IOException exception) {
            violations.add("src", RULE_ID,
                    "Could not close the foreign published payload surface scanner: " + exception.getMessage());
        }
    }

    private static Map<String, CarrierMetadata> collectPublishedCarriers(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            ViolationSink violations
    ) {
        Map<String, CarrierMetadata> carriers = new TreeMap<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            Matcher matcher = DOMAIN_PUBLISHED_PATH.matcher(sourceFile.relativePath());
            if (!matcher.matches()) {
                continue;
            }
            String featureName = matcher.group(1);
            parseSourceFile(context, compiler, fileManager, sourceFile, unit -> {
                PublishedCarrierCollector collector = new PublishedCarrierCollector(sourceFile.relativePath(), featureName, unit);
                collector.scan(unit, carriers);
            }, violations);
        }
        return carriers;
    }

    private static Map<String, CarrierUsage> collectQueryUsages(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            Map<String, CarrierMetadata> carriers,
            ViolationSink violations
    ) {
        Map<String, CarrierUsage> usages = new TreeMap<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            Matcher matcher = DATA_QUERY_PATH.matcher(sourceFile.relativePath());
            if (!matcher.matches()) {
                continue;
            }
            String queryFeature = matcher.group(1);
            parseSourceFile(context, compiler, fileManager, sourceFile, unit -> {
                QueryUsageCollector collector = new QueryUsageCollector(
                        sourceFile.relativePath(),
                        queryFeature,
                        unit,
                        carriers,
                        usages);
                collector.scan(unit, null);
            }, violations);
        }
        return usages;
    }

    private static void validatePayloadSurfaces(
            Map<String, CarrierMetadata> carriers,
            Map<String, CarrierUsage> usages,
            ViolationSink violations
    ) {
        List<CarrierMetadata> orderedCarriers = carriers.values().stream()
                .filter(CarrierMetadata::payloadCandidate)
                .sorted(Comparator.comparing(CarrierMetadata::qualifiedName))
                .toList();
        for (CarrierMetadata carrier : orderedCarriers) {
            CarrierUsage usage = usages.get(carrier.qualifiedName());
            if (usage == null || usage.usedAccessors().isEmpty()) {
                continue;
            }
            List<String> unusedAccessors = carrier.accessors().keySet().stream()
                    .filter(accessor -> !usage.usedAccessors().contains(accessor))
                    .sorted()
                    .toList();
            if (unusedAccessors.isEmpty()) {
                continue;
            }
            violations.add(
                    carrier.relativePath(),
                    RULE_ID,
                    "Foreign published payload carrier '" + carrier.qualifiedName()
                            + "' is consumed by foreign query adapter(s) "
                            + usage.consumerPaths()
                            + " through accessors "
                            + usage.usedAccessors()
                            + " but still exports unused accessors "
                            + unusedAccessors
                            + ". This violates the over-broad foreign published payload surface anti-pattern. "
                            + "Correct pattern: publish only the stable shared foreign facts the consumers actually read, "
                            + "instead of relaying a broader internal-shaped payload carrier.");
        }
    }

    private static void parseSourceFile(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            SourceFile sourceFile,
            SourceUnitConsumer consumer,
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
                consumer.accept(unit);
            }
        } catch (IOException exception) {
            violations.add(sourceFile.relativePath(), RULE_ID,
                    "Could not parse source file for the foreign published payload surface scan: "
                            + exception.getMessage());
        }
    }

    @FunctionalInterface
    private interface SourceUnitConsumer {
        void accept(CompilationUnitTree unit);
    }

    private static final class PublishedCarrierCollector extends TreePathScanner<Void, Map<String, CarrierMetadata>> {

        private final String relativePath;
        private final String featureName;
        private final ImportIndex imports;
        private final String packageName;

        private PublishedCarrierCollector(String relativePath, String featureName, CompilationUnitTree unit) {
            this.relativePath = relativePath;
            this.featureName = featureName;
            this.imports = ImportIndex.from(unit);
            this.packageName = unit.getPackageName() == null ? "" : unit.getPackageName().toString();
        }

        @Override
        public Void visitClass(ClassTree classTree, Map<String, CarrierMetadata> carriers) {
            if (classTree.getSimpleName().length() == 0
                    || !classTree.getModifiers().getFlags().contains(Modifier.PUBLIC)) {
                return null;
            }

            String simpleName = classTree.getSimpleName().toString();
            if (classTree.getKind() == Tree.Kind.ENUM || simpleName.endsWith("Model")) {
                return null;
            }

            Map<String, TypeRef> accessors = new LinkedHashMap<>();
            if (classTree.getKind() == Tree.Kind.RECORD) {
                for (Tree member : classTree.getMembers()) {
                    if (member instanceof VariableTree variableTree && isRecordComponent(variableTree)) {
                        accessors.put(
                                variableTree.getName().toString(),
                                TypeRef.parse(variableTree.getType() == null ? "" : variableTree.getType().toString(), imports, packageName));
                        continue;
                    }
                    if (member instanceof MethodTree methodTree
                            && methodTree.getModifiers() != null
                            && methodTree.getModifiers().getFlags().contains(Modifier.PUBLIC)
                            && !methodTree.getModifiers().getFlags().contains(Modifier.STATIC)
                            && methodTree.getParameters().isEmpty()
                            && methodTree.getReturnType() != null) {
                        String methodName = methodTree.getName().toString();
                        if (!OBJECT_METHODS.contains(methodName) && !accessors.containsKey(methodName)) {
                            accessors.put(
                                    methodName,
                                    TypeRef.parse(methodTree.getReturnType().toString(), imports, packageName));
                        }
                    }
                }
            } else {
                for (Tree member : classTree.getMembers()) {
                    if (!(member instanceof MethodTree methodTree)
                            || methodTree.getModifiers() == null
                            || !methodTree.getModifiers().getFlags().contains(Modifier.PUBLIC)
                            || methodTree.getModifiers().getFlags().contains(Modifier.STATIC)
                            || !methodTree.getParameters().isEmpty()) {
                        continue;
                    }
                    String methodName = methodTree.getName().toString();
                    if (OBJECT_METHODS.contains(methodName) || methodTree.getReturnType() == null) {
                        continue;
                    }
                    accessors.put(methodName, TypeRef.parse(methodTree.getReturnType().toString(), imports, packageName));
                }
            }
            if (accessors.isEmpty()) {
                return null;
            }

            String qualifiedName = packageName + "." + simpleName;
            carriers.put(qualifiedName, new CarrierMetadata(
                    relativePath,
                    featureName,
                    qualifiedName,
                    simpleName,
                    payloadCandidate(simpleName),
                    accessors));
            return null;
        }

        private static boolean isRecordComponent(VariableTree variableTree) {
            return variableTree.getInitializer() == null
                    && variableTree.getType() != null
                    && variableTree.getModifiers().getFlags().containsAll(Set.of(Modifier.PRIVATE, Modifier.FINAL));
        }

        private static boolean payloadCandidate(String simpleName) {
            return NON_PAYLOAD_SUFFIXES.stream().noneMatch(simpleName::endsWith);
        }
    }

    private static final class QueryUsageCollector extends TreePathScanner<Void, Void> {

        private final String relativePath;
        private final String queryFeature;
        private final Map<String, CarrierMetadata> carriers;
        private final Map<String, CarrierUsage> usages;
        private final ImportIndex imports;
        private final String packageName;
        private final Deque<Map<String, TypeRef>> scopes = new ArrayDeque<>();

        private QueryUsageCollector(
                String relativePath,
                String queryFeature,
                CompilationUnitTree unit,
                Map<String, CarrierMetadata> carriers,
                Map<String, CarrierUsage> usages
        ) {
            this.relativePath = relativePath;
            this.queryFeature = queryFeature;
            this.carriers = carriers;
            this.usages = usages;
            this.imports = ImportIndex.from(unit);
            this.packageName = unit.getPackageName() == null ? "" : unit.getPackageName().toString();
        }

        @Override
        public Void visitMethod(MethodTree methodTree, Void unused) {
            scopes.addLast(new LinkedHashMap<>());
            for (VariableTree parameter : methodTree.getParameters()) {
                scopes.getLast().put(parameter.getName().toString(),
                        TypeRef.parse(parameter.getType().toString(), imports, packageName));
            }
            try {
                return super.visitMethod(methodTree, unused);
            } finally {
                scopes.removeLast();
            }
        }

        @Override
        public Void visitBlock(BlockTree blockTree, Void unused) {
            scopes.addLast(new LinkedHashMap<>());
            try {
                return super.visitBlock(blockTree, unused);
            } finally {
                scopes.removeLast();
            }
        }

        @Override
        public Void visitVariable(VariableTree variableTree, Void unused) {
            super.visitVariable(variableTree, unused);
            TypeRef typeRef = variableTree.getType() == null
                    ? resolveExpressionType(variableTree.getInitializer())
                    : TypeRef.parse(variableTree.getType().toString(), imports, packageName);
            if (typeRef != null && !scopes.isEmpty()) {
                scopes.getLast().put(variableTree.getName().toString(), typeRef);
            }
            return null;
        }

        @Override
        public Void visitMethodInvocation(MethodInvocationTree invocationTree, Void unused) {
            super.visitMethodInvocation(invocationTree, unused);
            recordAccessorUse(invocationTree);
            return null;
        }

        private void recordAccessorUse(MethodInvocationTree invocationTree) {
            ExpressionTree receiver = receiverOf(invocationTree);
            if (receiver == null || !invocationTree.getArguments().isEmpty()) {
                return;
            }
            TypeRef receiverType = resolveExpressionType(receiver);
            if (receiverType == null || receiverType.qualifiedName() == null) {
                return;
            }
            CarrierMetadata carrier = carriers.get(receiverType.qualifiedName());
            if (carrier == null
                    || !carrier.payloadCandidate()
                    || carrier.featureName().equals(queryFeature)) {
                return;
            }
            String accessorName = invokedName(invocationTree);
            if (!carrier.accessors().containsKey(accessorName)) {
                return;
            }
            usages.computeIfAbsent(carrier.qualifiedName(), ignored -> new CarrierUsage())
                    .record(relativePath, accessorName);
        }

        private TypeRef resolveExpressionType(ExpressionTree expressionTree) {
            if (expressionTree == null) {
                return null;
            }
            if (expressionTree instanceof ParenthesizedTree parenthesizedTree) {
                return resolveExpressionType(parenthesizedTree.getExpression());
            }
            if (expressionTree instanceof TypeCastTree typeCastTree) {
                return TypeRef.parse(typeCastTree.getType().toString(), imports, packageName);
            }
            if (expressionTree instanceof IdentifierTree identifierTree) {
                return lookup(identifierTree.getName().toString());
            }
            if (expressionTree instanceof MemberSelectTree memberSelectTree) {
                return lookup(memberSelectTree.getIdentifier().toString());
            }
            if (expressionTree instanceof MethodInvocationTree invocationTree) {
                ExpressionTree receiver = receiverOf(invocationTree);
                if (receiver == null || !invocationTree.getArguments().isEmpty()) {
                    return null;
                }
                TypeRef receiverType = resolveExpressionType(receiver);
                if (receiverType == null || receiverType.qualifiedName() == null) {
                    return null;
                }
                CarrierMetadata carrier = carriers.get(receiverType.qualifiedName());
                if (carrier == null) {
                    return null;
                }
                return carrier.accessors().get(invokedName(invocationTree));
            }
            return null;
        }

        private TypeRef lookup(String variableName) {
            for (java.util.Iterator<Map<String, TypeRef>> iterator = scopes.descendingIterator(); iterator.hasNext(); ) {
                TypeRef typeRef = iterator.next().get(variableName);
                if (typeRef != null) {
                    return typeRef;
                }
            }
            return null;
        }

        private static ExpressionTree receiverOf(MethodInvocationTree invocationTree) {
            if (invocationTree.getMethodSelect() instanceof MemberSelectTree memberSelectTree) {
                return memberSelectTree.getExpression();
            }
            return null;
        }

        private static String invokedName(MethodInvocationTree invocationTree) {
            if (invocationTree.getMethodSelect() instanceof MemberSelectTree memberSelectTree) {
                return memberSelectTree.getIdentifier().toString();
            }
            if (invocationTree.getMethodSelect() instanceof IdentifierTree identifierTree) {
                return identifierTree.getName().toString();
            }
            return "";
        }
    }

    private static final class ImportIndex {

        private final Map<String, String> importsBySimpleName = new LinkedHashMap<>();

        private static ImportIndex from(CompilationUnitTree unit) {
            ImportIndex index = new ImportIndex();
            for (ImportTree importTree : unit.getImports()) {
                if (importTree.isStatic()) {
                    continue;
                }
                String importText = importTree.getQualifiedIdentifier().toString();
                int separator = importText.lastIndexOf('.');
                if (separator < 0 || importText.endsWith(".*")) {
                    continue;
                }
                index.importsBySimpleName.put(importText.substring(separator + 1), importText);
            }
            return index;
        }

        private String qualify(String typeName, String packageName) {
            String normalized = normalize(typeName);
            if (normalized.isBlank()
                    || normalized.equals("void")
                    || Character.isLowerCase(normalized.charAt(0))
                    || normalized.contains(".")) {
                return normalized;
            }
            return importsBySimpleName.getOrDefault(normalized, packageName + "." + normalized);
        }
    }

    private record TypeRef(String qualifiedName, String elementQualifiedName) {

        private static TypeRef parse(String typeText, ImportIndex imports, String packageName) {
            String normalized = normalize(typeText);
            if (normalized.isBlank()) {
                return null;
            }
            int genericStart = normalized.indexOf('<');
            if (genericStart < 0) {
                return new TypeRef(imports.qualify(normalized, packageName), null);
            }

            String rawType = normalized.substring(0, genericStart).trim();
            String genericBody = normalized.substring(genericStart + 1, normalized.lastIndexOf('>')).trim();
            String qualifiedRawType = imports.qualify(rawType, packageName);
            if (qualifiedRawType.equals("java.util.List")
                    || qualifiedRawType.equals("java.util.Set")
                    || qualifiedRawType.equals("java.util.Collection")) {
                return new TypeRef(qualifiedRawType, imports.qualify(genericBody, packageName));
            }
            return new TypeRef(qualifiedRawType, null);
        }
    }

    private record CarrierMetadata(
            String relativePath,
            String featureName,
            String qualifiedName,
            String simpleName,
            boolean payloadCandidate,
            Map<String, TypeRef> accessors
    ) {
    }

    private static final class CarrierUsage {

        private final Set<String> consumerPaths = new TreeSet<>();
        private final Set<String> usedAccessors = new TreeSet<>();

        private void record(String consumerPath, String accessor) {
            consumerPaths.add(consumerPath);
            usedAccessors.add(accessor);
        }

        private Set<String> consumerPaths() {
            return Set.copyOf(consumerPaths);
        }

        private Set<String> usedAccessors() {
            return Set.copyOf(usedAccessors);
        }
    }

    private static String normalize(String typeText) {
        return typeText
                .replace("@Nullable", "")
                .replace("final ", "")
                .trim();
    }
}
