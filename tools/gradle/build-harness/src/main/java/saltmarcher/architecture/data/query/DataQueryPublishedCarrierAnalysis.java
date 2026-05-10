package saltmarcher.architecture.data.query;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.ElementFilter;
import javax.lang.model.util.Types;
import javax.tools.JavaCompiler;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.SourceFile;

final class DataQueryPublishedCarrierAnalysis {

    static final String BLOCKER_RULE_ID = "data-query-no-overbroad-foreign-published-payload-surface";
    static final String CANDIDATE_RULE_ID = "data-query-foreign-published-carrier-thinning-candidate";

    private static final Pattern DOMAIN_PUBLISHED_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published(?:\\..+)?$");
    private static final Pattern DATA_QUERY_PACKAGE =
            Pattern.compile("^src\\.data\\.([^.]+)\\.query(?:\\..+)?$");
    private static final Pattern DOMAIN_PUBLISHED_MODEL_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.[A-Za-z0-9_]+Model$");
    static final Set<String> NON_PAYLOAD_SUFFIXES = Set.of("Command", "Model", "Result", "Status");
    static final Set<String> OBJECT_METHOD_NAMES = Set.of("toString", "hashCode", "equals", "getClass");

    private DataQueryPublishedCarrierAnalysis() {
    }

    static DataQueryPublishedCarrierAnalysisReport analyze(ArchitectureContext context) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            return DataQueryPublishedCarrierAnalysisReport.withBlocker(
                    new ArchitectureChecker.Violation(
                            "src",
                            BLOCKER_RULE_ID,
                            "The data query foreign published payload surface scan requires the JDK system compiler to analyze source files."));
        }

        List<SourceFile> relevantSourceFiles = context.sourceFiles(new saltmarcher.architecture.ViolationSink()).stream()
                .filter(sourceFile -> sourceFile.relativePath().startsWith("src/domain/")
                        || sourceFile.relativePath().startsWith("src/data/"))
                .toList();
        if (relevantSourceFiles.isEmpty()) {
            return DataQueryPublishedCarrierAnalysisReport.empty();
        }

        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null)) {
            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            List<Path> absolutePaths = relevantSourceFiles.stream()
                    .map(sourceFile -> context.repoRoot().resolve(sourceFile.relativePath()).normalize().toAbsolutePath())
                    .toList();
            JavacTask task = (JavacTask) compiler.getTask(
                    null,
                    fileManager,
                    diagnostics,
                    List.of("--release", "21", "-proc:none"),
                    null,
                    fileManager.getJavaFileObjectsFromPaths(absolutePaths));
            List<CompilationUnitTree> units = new ArrayList<>();
            for (CompilationUnitTree unit : task.parse()) {
                units.add(unit);
            }
            task.analyze();

            Trees trees = Trees.instance(task);
            Types types = task.getTypes();

            Map<String, DataQueryPublishedCarrierMetadata> carriers = collectPublishedCarriers(context, trees, units);
            Map<String, DataQueryPublishedCarrierConsumerUsage> consumerUsages =
                    collectQueryUsages(context, trees, types, units, carriers);
            return reportFor(carriers, consumerUsages);
        } catch (IOException exception) {
            return DataQueryPublishedCarrierAnalysisReport.withBlocker(new ArchitectureChecker.Violation(
                    "src",
                    BLOCKER_RULE_ID,
                    "Could not run the data query foreign published payload surface analysis: " + exception.getMessage()));
        }
    }

    private static Map<String, DataQueryPublishedCarrierMetadata> collectPublishedCarriers(
            ArchitectureContext context,
            Trees trees,
            List<CompilationUnitTree> units
    ) {
        Map<String, DataQueryPublishedCarrierMetadata> carriers = new TreeMap<>();
        for (CompilationUnitTree unit : units) {
            String packageName = packageName(unit);
            Matcher matcher = DOMAIN_PUBLISHED_PACKAGE.matcher(packageName);
            if (!matcher.matches()) {
                continue;
            }
            String featureName = matcher.group(1);
            String relativePath = unitPath(context, unit);
            for (var typeDeclaration : unit.getTypeDecls()) {
                if (!(typeDeclaration instanceof ClassTree classTree)) {
                    continue;
                }
                Element element = trees.getElement(TreePath.getPath(unit, classTree));
                if (!(element instanceof TypeElement typeElement) || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
                    continue;
                }
                DataQueryPublishedCarrierMetadata metadata =
                        DataQueryPublishedCarrierMetadata.from(typeElement, relativePath, featureName);
                if (!metadata.accessors().isEmpty()) {
                    carriers.put(metadata.qualifiedName(), metadata);
                }
            }
        }
        return carriers;
    }

    private static Map<String, DataQueryPublishedCarrierConsumerUsage> collectQueryUsages(
            ArchitectureContext context,
            Trees trees,
            Types types,
            List<CompilationUnitTree> units,
            Map<String, DataQueryPublishedCarrierMetadata> carriers
    ) {
        Map<String, DataQueryPublishedCarrierConsumerUsage> consumerUsages = new TreeMap<>();
        for (CompilationUnitTree unit : units) {
            String packageName = packageName(unit);
            Matcher matcher = DATA_QUERY_PACKAGE.matcher(packageName);
            if (!matcher.matches()) {
                continue;
            }
            String queryFeature = matcher.group(1);
            String consumerPath = unitPath(context, unit);
            QueryUsageScanner scanner = new QueryUsageScanner(queryFeature, consumerPath, trees, types, carriers);
            scanner.scan(unit, null);
            consumerUsages.put(consumerPath, scanner.finish());
        }
        return consumerUsages;
    }

    private static DataQueryPublishedCarrierAnalysisReport reportFor(
            Map<String, DataQueryPublishedCarrierMetadata> carriers,
            Map<String, DataQueryPublishedCarrierConsumerUsage> consumerUsages
    ) {
        Map<String, DataQueryPublishedCarrierUsageAggregate> aggregates = new TreeMap<>();
        for (DataQueryPublishedCarrierConsumerUsage consumerUsage : consumerUsages.values()) {
            consumerUsage.usedAccessorsByCarrier().forEach((carrierName, accessors) -> {
                if (accessors.isEmpty()) {
                    return;
                }
                aggregates.computeIfAbsent(carrierName, ignored -> new DataQueryPublishedCarrierUsageAggregate())
                        .record(consumerUsage.consumerPath(), accessors);
            });
        }

        List<ArchitectureChecker.Violation> blockers = new ArrayList<>();
        List<ArchitectureChecker.Violation> candidates = new ArrayList<>();
        for (DataQueryPublishedCarrierMetadata carrier : carriers.values().stream()
                .filter(DataQueryPublishedCarrierMetadata::payloadCandidate)
                .sorted(Comparator.comparing(DataQueryPublishedCarrierMetadata::qualifiedName))
                .toList()) {
            DataQueryPublishedCarrierUsageAggregate aggregate = aggregates.get(carrier.qualifiedName());
            if (aggregate == null || aggregate.globalUsedAccessors().isEmpty()) {
                continue;
            }

            List<String> globallyUnused = carrier.accessorNames().stream()
                    .filter(accessor -> !aggregate.globalUsedAccessors().contains(accessor))
                    .sorted()
                    .toList();
            if (!globallyUnused.isEmpty()) {
                blockers.add(new ArchitectureChecker.Violation(
                        carrier.relativePath(),
                        BLOCKER_RULE_ID,
                        "Foreign published payload carrier '" + carrier.qualifiedName()
                                + "' is consumed by foreign query adapter(s) "
                                + aggregate.consumerPaths()
                                + " through accessors "
                                + aggregate.globalUsedAccessors()
                                + " but still exports globally unused accessors "
                                + globallyUnused
                                + ". This violates the over-broad foreign published payload surface anti-pattern. "
                                + "Correct pattern: publish only the stable shared foreign facts the consumers actually read, "
                                + "instead of relaying a broader internal-shaped payload carrier."));
                continue;
            }

            if (aggregate.consumerPaths().size() < 2) {
                continue;
            }

            for (Map.Entry<String, Set<String>> consumerEntry : aggregate.usedAccessorsByConsumer().entrySet()) {
                Set<String> usedByConsumer = consumerEntry.getValue();
                if (usedByConsumer.containsAll(aggregate.globalUsedAccessors())
                        && aggregate.globalUsedAccessors().containsAll(usedByConsumer)) {
                    continue;
                }
                candidates.add(new ArchitectureChecker.Violation(
                        consumerEntry.getKey(),
                        CANDIDATE_RULE_ID,
                        "Query adapter '" + consumerEntry.getKey()
                                + "' reads shared foreign published payload carrier '" + carrier.qualifiedName()
                                + "' through accessors "
                                + sorted(usedByConsumer)
                                + " while the carrier is globally consumed through "
                                + aggregate.globalUsedAccessors()
                                + " across consumers "
                                + aggregate.consumerPaths()
                                + ". This is the foreign published carrier thinning candidate pattern. "
                                + "Correct pattern: keep the shared carrier minimal, or split a thinner foreign published sub-carrier for this narrower consumer slice."));
            }
        }

        return new DataQueryPublishedCarrierAnalysisReport(blockers, candidates);
    }

    private static String packageName(CompilationUnitTree unit) {
        return unit.getPackageName() == null ? "" : unit.getPackageName().toString();
    }

    private static String unitPath(ArchitectureContext context, CompilationUnitTree unit) {
        return context.relativize(Path.of(unit.getSourceFile().toUri()));
    }

    private static List<String> sorted(Collection<String> values) {
        return values.stream().sorted().toList();
    }

    private static final class QueryUsageScanner extends TreePathScanner<Void, Void> {

        private final String queryFeature;
        private final String consumerPath;
        private final Trees trees;
        private final Types types;
        private final Map<String, DataQueryPublishedCarrierMetadata> carriers;
        private final Set<String> reachablePayloadCarriers = new LinkedHashSet<>();
        private final Map<String, Set<String>> accessorUses = new LinkedHashMap<>();

        private QueryUsageScanner(
                String queryFeature,
                String consumerPath,
                Trees trees,
                Types types,
                Map<String, DataQueryPublishedCarrierMetadata> carriers
        ) {
            this.queryFeature = queryFeature;
            this.consumerPath = consumerPath;
            this.trees = trees;
            this.types = types;
            this.carriers = carriers;
        }

        @Override
        public Void visitMethodInvocation(MethodInvocationTree node, Void unused) {
            recordExecutableElement(currentExecutableElement());
            return super.visitMethodInvocation(node, unused);
        }

        @Override
        public Void visitMemberReference(MemberReferenceTree node, Void unused) {
            recordExecutableElement(currentExecutableElement());
            return super.visitMemberReference(node, unused);
        }

        private void recordExecutableElement(ExecutableElement executableElement) {
            if (executableElement == null) {
                return;
            }

            String ownerQualifiedName = ownerQualifiedName(executableElement);
            String currentFeature = foreignModelFeature(ownerQualifiedName);
            if (currentFeature != null
                    && !currentFeature.equals(queryFeature)
                    && executableElement.getSimpleName().contentEquals("current")
                    && executableElement.getParameters().isEmpty()) {
                reachablePayloadCarriers.addAll(expandPayloadCarriers(executableElement.getReturnType()));
            }

            DataQueryPublishedCarrierMetadata carrier = carriers.get(ownerQualifiedName);
            if (carrier == null || !carrier.payloadCandidate()) {
                return;
            }
            if (carrier.featureName().equals(queryFeature)
                    || executableElement.getModifiers().contains(Modifier.STATIC)
                    || !executableElement.getParameters().isEmpty()) {
                return;
            }
            String accessorName = executableElement.getSimpleName().toString();
            if (!carrier.accessors().containsKey(accessorName)) {
                return;
            }
            accessorUses.computeIfAbsent(carrier.qualifiedName(), ignored -> new LinkedHashSet<>()).add(accessorName);
        }

        private ExecutableElement currentExecutableElement() {
            Element element = trees.getElement(getCurrentPath());
            return element instanceof ExecutableElement executableElement ? executableElement : null;
        }

        private Set<String> expandPayloadCarriers(TypeMirror rootType) {
            Set<String> discovered = new LinkedHashSet<>();
            expandPayloadCarriers(rootType, new LinkedHashSet<>(), discovered);
            return discovered;
        }

        private void expandPayloadCarriers(
                TypeMirror typeMirror,
                Set<String> visitedTypeNames,
                Set<String> discovered
        ) {
            if (typeMirror == null) {
                return;
            }
            if (typeMirror.getKind() == TypeKind.ARRAY) {
                expandPayloadCarriers(((ArrayType) typeMirror).getComponentType(), visitedTypeNames, discovered);
                return;
            }
            if (typeMirror.getKind() == TypeKind.TYPEVAR) {
                expandPayloadCarriers(((TypeVariable) typeMirror).getUpperBound(), visitedTypeNames, discovered);
                return;
            }
            if (typeMirror.getKind() == TypeKind.WILDCARD) {
                WildcardType wildcardType = (WildcardType) typeMirror;
                expandPayloadCarriers(wildcardType.getExtendsBound(), visitedTypeNames, discovered);
                expandPayloadCarriers(wildcardType.getSuperBound(), visitedTypeNames, discovered);
                return;
            }
            if (!(typeMirror instanceof DeclaredType declaredType)) {
                return;
            }

            Element element = declaredType.asElement();
            if (!(element instanceof TypeElement typeElement)) {
                return;
            }

            String qualifiedName = typeElement.getQualifiedName().toString();
            if (!visitedTypeNames.add(qualifiedName)) {
                return;
            }

            for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                expandPayloadCarriers(typeArgument, visitedTypeNames, discovered);
            }

            DataQueryPublishedCarrierMetadata carrier = carriers.get(qualifiedName);
            if (carrier == null) {
                return;
            }
            if (carrier.payloadCandidate() && !carrier.featureName().equals(queryFeature)) {
                discovered.add(qualifiedName);
            }
            for (ExecutableElement accessor : carrier.accessors().values()) {
                expandPayloadCarriers(accessor.getReturnType(), visitedTypeNames, discovered);
            }
        }

        private DataQueryPublishedCarrierConsumerUsage finish() {
            Map<String, Set<String>> filteredUsage = new TreeMap<>();
            for (String carrierName : reachablePayloadCarriers) {
                Set<String> usedAccessors = accessorUses.get(carrierName);
                if (usedAccessors != null && !usedAccessors.isEmpty()) {
                    filteredUsage.put(carrierName, Set.copyOf(usedAccessors));
                }
            }
            return new DataQueryPublishedCarrierConsumerUsage(
                    consumerPath,
                    Set.copyOf(reachablePayloadCarriers),
                    filteredUsage);
        }
    }

    private static String foreignModelFeature(String ownerQualifiedName) {
        Matcher matcher = DOMAIN_PUBLISHED_MODEL_TYPE.matcher(ownerQualifiedName);
        return matcher.matches() ? matcher.group(1) : null;
    }

    private static String ownerQualifiedName(ExecutableElement executableElement) {
        Element enclosingElement = executableElement.getEnclosingElement();
        return enclosingElement instanceof TypeElement typeElement
                ? typeElement.getQualifiedName().toString()
                : "";
    }

}

record DataQueryPublishedCarrierAnalysisReport(
        List<ArchitectureChecker.Violation> blockerViolations,
        List<ArchitectureChecker.Violation> candidateViolations
) {
    DataQueryPublishedCarrierAnalysisReport {
        blockerViolations = List.copyOf(blockerViolations);
        candidateViolations = List.copyOf(candidateViolations);
    }

    static DataQueryPublishedCarrierAnalysisReport empty() {
        return new DataQueryPublishedCarrierAnalysisReport(List.of(), List.of());
    }

    static DataQueryPublishedCarrierAnalysisReport withBlocker(ArchitectureChecker.Violation blocker) {
        return new DataQueryPublishedCarrierAnalysisReport(List.of(blocker), List.of());
    }
}

record DataQueryPublishedCarrierConsumerUsage(
        String consumerPath,
        Set<String> reachablePayloadCarriers,
        Map<String, Set<String>> usedAccessorsByCarrier
) {

    DataQueryPublishedCarrierConsumerUsage {
        reachablePayloadCarriers = Set.copyOf(reachablePayloadCarriers);
        Map<String, Set<String>> normalized = new TreeMap<>();
        usedAccessorsByCarrier.forEach((carrier, accessors) -> normalized.put(carrier, Set.copyOf(accessors)));
        usedAccessorsByCarrier = Map.copyOf(normalized);
    }
}

final class DataQueryPublishedCarrierUsageAggregate {

    private final Set<String> consumerPaths = new TreeSet<>();
    private final Set<String> globalUsedAccessors = new TreeSet<>();
    private final Map<String, Set<String>> usedAccessorsByConsumer = new TreeMap<>();

    void record(String consumerPath, Set<String> usedAccessors) {
        consumerPaths.add(consumerPath);
        globalUsedAccessors.addAll(usedAccessors);
        usedAccessorsByConsumer.put(consumerPath, new TreeSet<>(usedAccessors));
    }

    List<String> consumerPaths() {
        return List.copyOf(consumerPaths);
    }

    List<String> globalUsedAccessors() {
        return List.copyOf(globalUsedAccessors);
    }

    Map<String, Set<String>> usedAccessorsByConsumer() {
        return Map.copyOf(usedAccessorsByConsumer);
    }
}

record DataQueryPublishedCarrierMetadata(
        String relativePath,
        String featureName,
        String qualifiedName,
        String simpleName,
        boolean payloadCandidate,
        Map<String, ExecutableElement> accessors
) {

    DataQueryPublishedCarrierMetadata {
        accessors = Map.copyOf(accessors);
    }

    static DataQueryPublishedCarrierMetadata from(TypeElement typeElement, String relativePath, String featureName) {
        Map<String, ExecutableElement> accessors = new LinkedHashMap<>();
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (!method.getModifiers().contains(Modifier.PUBLIC)
                    || method.getModifiers().contains(Modifier.STATIC)
                    || !method.getParameters().isEmpty()
                    || method.getKind() != ElementKind.METHOD) {
                continue;
            }
            String methodName = method.getSimpleName().toString();
            if (DataQueryPublishedCarrierAnalysis.OBJECT_METHOD_NAMES.contains(methodName)) {
                continue;
            }
            accessors.putIfAbsent(methodName, method);
        }
        String simpleName = typeElement.getSimpleName().toString();
        return new DataQueryPublishedCarrierMetadata(
                relativePath,
                featureName,
                typeElement.getQualifiedName().toString(),
                simpleName,
                DataQueryPublishedCarrierAnalysis.NON_PAYLOAD_SUFFIXES.stream().noneMatch(simpleName::endsWith),
                accessors);
    }

    List<String> accessorNames() {
        return accessors.keySet().stream().sorted().toList();
    }
}
