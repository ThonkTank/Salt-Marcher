package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.Tree
import com.sun.source.util.TreePath
import java.io.File
import java.util.Collections
import java.util.IdentityHashMap
import javax.lang.model.element.ElementKind
import javax.lang.model.element.Element
import javax.lang.model.element.ExecutableElement
import javax.lang.model.element.TypeElement
import javax.lang.model.type.ArrayType
import javax.lang.model.type.DeclaredType
import javax.lang.model.type.IntersectionType
import javax.lang.model.type.TypeMirror
import javax.lang.model.type.TypeVariable
import javax.lang.model.type.UnionType
import javax.lang.model.type.WildcardType
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.SourceSetContainer

data class OwnerConventionTypeImports(
    val explicitTypes: Map<String, String>,
    val wildcardPackages: Set<String>,
    val importedPackages: List<String>
)

data class OwnerConventionSourceContext(
    val path: String,
    val file: File,
    val packageName: String,
    val dirName: String,
    val role: String,
    val ownerPackage: String,
    val className: String,
    val typeImports: OwnerConventionTypeImports
)

internal data class OwnerConventionSnapshot(
    val touchedPaths: Set<String>,
    val knownPackages: Set<String>,
    val knownTypeNames: Set<String>,
    val requestStemsByOwner: Map<String, Set<String>>,
    val parsedSourcesByPath: Map<String, OwnerConventionParsedJavaSource>,
    val parsedTypesByName: Map<String, OwnerConventionParsedJavaType>,
    val catalog: OwnerConventionCatalog,
    val semanticModel: OwnerConventionSemanticModel,
    val callIndex: OwnerConventionCallIndex
)

internal data class OwnerConventionSourceFile(
    val context: OwnerConventionSourceContext,
    val sourceText: String,
    val declaredPackage: String?,
    val placementIssues: List<String>,
    val parsedSource: OwnerConventionParsedJavaSource
)

data class OwnerConventionRoleDeduction(
    val role: String,
    val issues: List<String>
)

class OwnerConventionSupport(private val project: Project) {
    val ownerRole = "owner"
    val inputRole = "input"
    val taskRole = "task"
    val repositoryRole = "repository"
    val stateRole = "state"
    val bucketRole = "bucket"
    val invalidRole = "invalid"

    private val projectDir = project.layout.projectDirectory.asFile
    private val projectRoot = projectDir.toPath()
    private val srcRootPath = projectDir.resolve("src").toPath()
    private val reservedRequestStemSuffixes = setOf("Input", "Task", "Request", "State", "Repository", "Object", "Owner")
    private val layerRoles = setOf(inputRole, taskRole, repositoryRole, stateRole)
    private val sharedSnapshot: OwnerConventionSnapshot by lazy {
        buildSnapshot()
    }

    internal fun registerCheck(
        taskName: String,
        taskDescription: String,
        failureHeader: String,
        failureSummary: String,
        applicableRoles: Set<String>? = null,
        reasonCollector: (OwnerConventionSourceFile, OwnerConventionSnapshot) -> List<String>
    ): TaskProvider<Task> = project.tasks.register(taskName) {
        group = "verification"
        description = taskDescription

        doLast {
            val offenders = offenders(applicableRoles, reasonCollector)
            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { offender -> " - $offender" }
                throw GradleException(
                    "$failureHeader\n" +
                        "$failureSummary\n" +
                        "Offending files:\n$details"
                )
            }
        }
    }

    internal fun roleDispatchReasons(sourceFile: OwnerConventionSourceFile): List<String> {
        val reasons = mutableListOf<String>()
        val expectedPackage = packageNameFor(sourceFile.context.file.parentFile)
        if (sourceFile.declaredPackage != expectedPackage) {
            reasons += "${sourceFile.context.path} :: package must match the filesystem grammar exactly ($expectedPackage)"
        }
        if (sourceFile.context.role == invalidRole) {
            sourceFile.placementIssues.forEach { issue ->
                reasons += "${sourceFile.context.path} :: $issue"
            }
        }
        return reasons
    }

    internal fun bucketFileReasons(sourceFile: OwnerConventionSourceFile): List<String> {
        return listOf("${sourceFile.context.path} :: *Bucket directories must not contain Java files")
    }

    internal fun directChildren(dir: File): List<File> {
        return dir.listFiles()?.sortedBy(File::getName).orEmpty()
    }

    internal fun normalizedToken(token: String): String {
        return token.filter(Char::isLetterOrDigit).lowercase()
    }

    internal fun requestStemForFile(fileName: String, expectedSuffix: String): String? {
        val suffix = "$expectedSuffix.java"
        if (!fileName.endsWith(suffix)) {
            return null
        }
        val stem = fileName.removeSuffix(suffix)
        if (!Regex("""[A-Z][A-Za-z0-9]*""").matches(stem)) {
            return null
        }
        if (reservedRequestStemSuffixes.any { reserved -> stem.endsWith(reserved) }) {
            return null
        }
        return stem
    }

    internal fun requestStemForMethod(methodName: String): String? {
        if (!Regex("""[a-z][A-Za-z0-9]*""").matches(methodName)) {
            return null
        }
        val stem = methodName.replaceFirstChar { ch -> ch.titlecase() }
        if (reservedRequestStemSuffixes.any { reserved -> stem.endsWith(reserved) }) {
            return null
        }
        return stem
    }

    internal fun ownerObjectName(ownerPackage: String): String {
        return ownerPackage.substringAfterLast('.').replaceFirstChar { it.titlecase() } + "Object"
    }

    internal fun roleForDirectoryName(name: String): String {
        return when (name) {
            inputRole -> inputRole
            taskRole -> taskRole
            repositoryRole -> repositoryRole
            stateRole -> stateRole
            else -> if (name.endsWith("Bucket")) bucketRole else ownerRole
        }
    }

    internal fun ownerPackageFor(packageName: String, role: String): String {
        return when (role) {
            inputRole, taskRole, repositoryRole, stateRole, bucketRole -> packageName.substringBeforeLast('.', "")
            else -> packageName
        }
    }

    internal fun sameOwner(sourceOwnerPackage: String, targetPackage: String): Boolean {
        val targetRole = roleForDirectoryName(targetPackage.substringAfterLast('.'))
        return ownerPackageFor(targetPackage, targetRole) == sourceOwnerPackage
    }

    internal fun sameOwnerEdgeOrNeighbor(sourceOwnerPackage: String, targetOwnerPackage: String): Boolean {
        if (sourceOwnerPackage == targetOwnerPackage) {
            return true
        }
        val sourceSegments = sourceOwnerPackage.split('.')
        val targetSegments = targetOwnerPackage.split('.')
        val sourceParent = sourceSegments.dropLast(1)
        val targetParent = targetSegments.dropLast(1)
        return sourceParent == targetSegments || targetParent == sourceSegments || sourceParent == targetParent
    }

    internal fun parsedPrimaryType(sourceFile: OwnerConventionSourceFile): OwnerConventionParsedJavaType? {
        val expectedName = sourceFile.context.className.removeSuffix(".java")
        return sourceFile.parsedSource.topLevelTypes.firstOrNull { type -> type.name == expectedName }
    }

    internal fun projectTypePackages(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): Set<String> {
        return projectTypeNames(tree, parsedSource, snapshot)
            .map { typeName -> typeName.substringBeforeLast('.') }
            .toSet()
    }

    internal fun projectTypeNames(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): Set<String> {
        val path = treePath(tree, parsedSource) ?: return emptySet()
        return projectTypeNamesForPath(path, snapshot)
    }

    private fun resolveKnownTopLevelTypeName(typeName: String, knownTypeNames: Set<String>): String? {
        var candidate = typeName
        while (candidate.isNotBlank()) {
            if (candidate in knownTypeNames) {
                return candidate
            }
            val lastDot = candidate.lastIndexOf('.')
            if (lastDot < 0) {
                return null
            }
            candidate = candidate.substring(0, lastDot)
        }
        return null
    }

    internal fun projectPackageForTypeName(typeName: String, knownTypeNames: Set<String>): String? {
        return if (typeName in knownTypeNames) typeName.substringBeforeLast('.') else null
    }

    internal fun resolveProjectTypeName(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): String? {
        return projectTypeNames(tree, parsedSource, snapshot).singleOrNull()
    }

    internal fun declaredProjectTypeName(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): String? {
        val typeName = topLevelTypeNameForTree(tree, parsedSource, snapshot) ?: return null
        return typeName.takeIf { it in snapshot.knownTypeNames }
    }

    internal fun typeNames(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): Set<String> {
        val path = treePath(tree, parsedSource) ?: return emptySet()
        return typeNamesForPath(path, snapshot)
    }

    internal fun resolveTypeName(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): String? {
        return typeNames(tree, parsedSource, snapshot).singleOrNull()
    }

    internal fun elementFor(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): Element? {
        val path = treePath(tree, parsedSource) ?: return null
        return snapshot.semanticModel.trees.getElement(path)
    }

    internal fun topLevelTypeNameForTree(
        tree: Tree?,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): String? {
        return topLevelTypeName(elementFor(tree, parsedSource, snapshot))
    }

    internal fun ownerRequestTaskTypeName(ownerPackage: String, requestStem: String): String {
        return "$ownerPackage.$taskRole.${requestStem}Task"
    }

    internal fun isCanonicalInputAccessorInvocation(
        receiverTypeName: String,
        invocation: MethodInvocationTree,
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): Boolean {
        if (snapshot.catalog.inputApisByTypeName[receiverTypeName] == null || invocation.arguments.isNotEmpty()) {
            return false
        }
        val methodElement = elementFor(invocation, parsedSource, snapshot) as? ExecutableElement ?: return false
        return isCanonicalInputAccessorMethod(methodElement)
    }

    internal fun parsedType(typeName: String, snapshot: OwnerConventionSnapshot): OwnerConventionParsedJavaType? {
        return snapshot.parsedTypesByName[typeName]
    }

    private fun offenders(
        applicableRoles: Set<String>?,
        reasonCollector: (OwnerConventionSourceFile, OwnerConventionSnapshot) -> List<String>
    ): List<String> {
        val snapshot = sharedSnapshot
        if (snapshot.touchedPaths.isEmpty()) {
            return emptyList()
        }
        return touchedSourceFiles(snapshot)
            .asSequence()
            .filter { sourceFile -> applicableRoles == null || sourceFile.context.role in applicableRoles }
            .flatMap { sourceFile -> reasonCollector(sourceFile, snapshot).asSequence() }
            .sorted()
            .toList()
    }

    private fun buildSnapshot(): OwnerConventionSnapshot {
        val touchedPaths = touchedJavaPaths()
        val allSourceFiles = project.fileTree("src") {
            include("**/*.java")
            exclude("**/package-info.java")
        }.files.sortedBy(File::getPath)
        val parsedJavaSources = parseOwnerConventionJavaSources(
            projectRoot = projectRoot,
            files = allSourceFiles,
            classpath = mainCompileClasspath()
        )
        val parsedSourcesByPath = parsedJavaSources.sourcesByPath
        val knownPackages = parsedSourcesByPath.values
            .mapNotNull(OwnerConventionParsedJavaSource::packageName)
            .toSet()
        val knownTypeNames = parsedSourcesByPath.values
            .flatMap { parsedSource ->
                val packageName = parsedSource.packageName ?: return@flatMap emptyList()
                parsedSource.topLevelTypes.map { type -> "$packageName.${type.name}" }
            }
            .toSet()
        val parsedTypesByName = parsedSourcesByPath.values
            .flatMap { parsedSource ->
                val packageName = parsedSource.packageName ?: return@flatMap emptyList()
                parsedSource.topLevelTypes.map { type -> "$packageName.${type.name}" to type }
            }
            .toMap()
        val baseSnapshot = OwnerConventionSnapshot(
            touchedPaths = touchedPaths,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            requestStemsByOwner = emptyMap(),
            parsedSourcesByPath = parsedSourcesByPath,
            parsedTypesByName = parsedTypesByName,
            catalog = OwnerConventionCatalog.EMPTY,
            semanticModel = parsedJavaSources.semanticModel,
            callIndex = OwnerConventionCallIndex.EMPTY
        )
        val catalog = buildOwnerConventionCatalog(snapshot = baseSnapshot)
        val catalogSnapshot = OwnerConventionSnapshot(
            touchedPaths = touchedPaths,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            requestStemsByOwner = catalog.ownerSurfacesByOwner.mapValues { (_, surface) -> surface.requestStems },
            parsedSourcesByPath = parsedSourcesByPath,
            parsedTypesByName = parsedTypesByName,
            catalog = catalog,
            semanticModel = parsedJavaSources.semanticModel,
            callIndex = OwnerConventionCallIndex.EMPTY
        )
        val callIndex = buildOwnerConventionCallIndex(catalogSnapshot)
        return catalogSnapshot.copy(
            callIndex = callIndex
        )
    }

    private fun touchedSourceFiles(snapshot: OwnerConventionSnapshot): List<OwnerConventionSourceFile> {
        return sourceFiles(snapshot)
            .asSequence()
            .filter { sourceFile -> sourceFile.context.path in snapshot.touchedPaths }
            .toList()
    }

    internal fun sourceFiles(snapshot: OwnerConventionSnapshot): List<OwnerConventionSourceFile> {
        return snapshot.parsedSourcesByPath.values
            .map { parsedSource -> sourceFileFor(parsedSource, snapshot) }
            .sortedBy { sourceFile -> sourceFile.context.path }
    }

    private fun sourceFileFor(
        parsedSource: OwnerConventionParsedJavaSource,
        snapshot: OwnerConventionSnapshot
    ): OwnerConventionSourceFile {
        val packageName = parsedSource.packageName ?: packageNameFor(parsedSource.file.parentFile)
        val roleDeduction = deduceRole(parsedSource.file.parentFile)
        val typeImports = typeImportsFor(parsedSource.importDeclarations, snapshot.knownPackages)
        return OwnerConventionSourceFile(
            context = OwnerConventionSourceContext(
                path = parsedSource.path,
                file = parsedSource.file,
                packageName = packageName,
                dirName = parsedSource.file.parentFile.name,
                role = roleDeduction.role,
                ownerPackage = ownerPackageFor(packageName, roleDeduction.role),
                className = parsedSource.file.name,
                typeImports = typeImports
            ),
            sourceText = parsedSource.file.readText(),
            declaredPackage = parsedSource.packageName,
            placementIssues = roleDeduction.issues,
            parsedSource = parsedSource
        )
    }

    private fun touchedJavaPaths(): Set<String> {
        val changed = linkedSetOf<String>()
        val currentBranch = gitStdout("branch", "--show-current")
        val committedDiffs = if (currentBranch == "main") {
            emptyList()
        } else {
            val mergeBase = gitStdout("merge-base", "HEAD", "origin/main")
            listOf(gitLines("diff", "--name-only", "--diff-filter=ACMR", "$mergeBase..HEAD", "--", "src"))
        }
        (committedDiffs + listOf(
            gitLines("diff", "--name-only", "--cached", "--diff-filter=ACMR", "--", "src"),
            gitLines("diff", "--name-only", "--diff-filter=ACMR", "--", "src"),
            gitLines("ls-files", "--others", "--exclude-standard", "--", "src")
        )).forEach { lines ->
            lines.asSequence()
                .filter { line -> line.endsWith(".java") }
                .forEach(changed::add)
        }
        return changed
    }

    private fun gitStdout(vararg args: String): String {
        val process = ProcessBuilder(listOf("git", *args))
            .directory(projectDir)
            .redirectErrorStream(true)
            .start()
        val output = process.inputStream.bufferedReader().use { reader -> reader.readText() }
        val exitCode = process.waitFor()
        if (exitCode != 0) {
            throw GradleException("Git command failed (${args.joinToString(" ")}).\n$output")
        }
        return output.trim()
    }

    private fun gitLines(vararg args: String): List<String> {
        return gitStdout(*args)
            .lines()
            .map(String::trim)
            .filter(String::isNotBlank)
    }

    private fun deduceRole(dir: File): OwnerConventionRoleDeduction {
        val segments = srcRelativeSegments(dir)
        if (segments.isEmpty()) {
            return OwnerConventionRoleDeduction(ownerRole, emptyList())
        }
        val issues = mutableListOf<String>()
        val ancestorRoles = segments.dropLast(1).map(::roleForDirectoryName)
        val bucketCount = segments.count { roleForDirectoryName(it) == bucketRole }
        ancestorRoles.forEach { ancestorRole ->
            if (ancestorRole in layerRoles) {
                issues += "layer directories must stay flat and may not contain nested directories"
            }
        }
        if (bucketCount > 1) {
            issues += "*Bucket directories may not contain nested *Bucket directories"
        }
        val finalRole = roleForDirectoryName(segments.last())
        return if (issues.isNotEmpty()) {
            OwnerConventionRoleDeduction(invalidRole, issues.distinct())
        } else {
            OwnerConventionRoleDeduction(finalRole, emptyList())
        }
    }

    private fun srcRelativeSegments(file: File): List<String> {
        val relativePath = srcRootPath.relativize(file.toPath()).toString().replace('\\', '/')
        if (relativePath.isBlank()) {
            return emptyList()
        }
        return relativePath.split('/').filter(String::isNotBlank)
    }

    private fun packageNameFor(file: File): String {
        return srcRelativeSegments(file).joinToString(".")
    }

    internal fun typeImportsFor(importDeclarations: List<String>, knownPackages: Set<String>): OwnerConventionTypeImports {
        val explicitTypes = linkedMapOf<String, String>()
        val wildcardPackages = linkedSetOf<String>()
        val importedPackages = mutableListOf<String>()
        importDeclarations.forEach { imported ->
            importedPackageName(imported, knownPackages)?.let(importedPackages::add)
            if (imported.endsWith(".*")) {
                wildcardPackages += imported.removeSuffix(".*")
            } else {
                explicitTypes[imported.substringAfterLast('.')] = imported
            }
        }
        return OwnerConventionTypeImports(
            explicitTypes = explicitTypes,
            wildcardPackages = wildcardPackages,
            importedPackages = importedPackages
        )
    }

    private fun importedPackageName(imported: String, knownPackages: Set<String>): String? {
        var candidate = imported.removeSuffix(".*")
        while (candidate.isNotBlank()) {
            if (candidate in knownPackages) {
                return candidate
            }
            val lastDot = candidate.lastIndexOf('.')
            if (lastDot < 0) {
                return null
            }
            candidate = candidate.substring(0, lastDot)
        }
        return null
    }

    private fun mainCompileClasspath(): Collection<File> {
        val sourceSets = project.extensions.findByType(SourceSetContainer::class.java) ?: return emptyList()
        return sourceSets.getByName("main").compileClasspath.files.sortedBy(File::getAbsolutePath)
    }

    private fun treePath(tree: Tree?, parsedSource: OwnerConventionParsedJavaSource): TreePath? {
        return if (tree == null) null else TreePath.getPath(parsedSource.compilationUnit, tree)
    }

    private fun projectTypeNamesForPath(
        path: TreePath,
        snapshot: OwnerConventionSnapshot
    ): Set<String> {
        val projectTypes = linkedSetOf<String>()
        addProjectTypeName(snapshot.semanticModel.trees.getElement(path), snapshot.knownTypeNames, projectTypes)
        collectProjectTypeNames(snapshot.semanticModel.trees.getTypeMirror(path), snapshot.knownTypeNames, projectTypes)
        return projectTypes
    }

    private fun typeNamesForPath(
        path: TreePath,
        snapshot: OwnerConventionSnapshot
    ): Set<String> {
        val typeNames = linkedSetOf<String>()
        addTypeName(snapshot.semanticModel.trees.getElement(path), typeNames)
        collectTypeNames(snapshot.semanticModel.trees.getTypeMirror(path), typeNames)
        return typeNames
    }

    private fun addProjectTypeName(
        element: Element?,
        knownTypeNames: Set<String>,
        projectTypes: MutableSet<String>
    ) {
        val topLevelType = topLevelTypeElement(element) ?: return
        val typeName = topLevelType.qualifiedName.toString()
        if (typeName in knownTypeNames) {
            projectTypes += typeName
        }
    }

    private fun topLevelTypeElement(element: Element?): TypeElement? {
        var current = element
        var topLevelType: TypeElement? = null
        while (current != null) {
            if (current is TypeElement) {
                topLevelType = current
            }
            current = current.enclosingElement
        }
        return topLevelType
    }

    internal fun topLevelTypeName(element: Element?): String? {
        return topLevelTypeElement(element)?.qualifiedName?.toString()?.takeIf(String::isNotBlank)
    }

    private fun isCanonicalInputAccessorMethod(methodElement: ExecutableElement): Boolean {
        if (methodElement.parameters.isNotEmpty()) {
            return false
        }
        val declaringType = methodElement.enclosingElement as? TypeElement ?: return false
        if (declaringType.kind != ElementKind.RECORD) {
            return false
        }
        return declaringType.recordComponents.any { component ->
            component.simpleName.contentEquals(methodElement.simpleName)
        }
    }

    private fun addTypeName(
        element: Element?,
        typeNames: MutableSet<String>
    ) {
        val topLevelType = topLevelTypeElement(element) ?: return
        val typeName = topLevelType.qualifiedName.toString()
        if (typeName.isNotBlank()) {
            typeNames += typeName
        }
    }

    private fun collectProjectTypeNames(
        typeMirror: TypeMirror?,
        knownTypeNames: Set<String>,
        projectTypes: MutableSet<String>
    ) {
        collectProjectTypeNames(
            typeMirror = typeMirror,
            knownTypeNames = knownTypeNames,
            projectTypes = projectTypes,
            visited = Collections.newSetFromMap(IdentityHashMap())
        )
    }

    private fun collectProjectTypeNames(
        typeMirror: TypeMirror?,
        knownTypeNames: Set<String>,
        projectTypes: MutableSet<String>,
        visited: MutableSet<TypeMirror>
    ) {
        if (typeMirror == null || !visited.add(typeMirror)) {
            return
        }
        when (typeMirror) {
            is DeclaredType -> {
                addProjectTypeName(typeMirror.asElement(), knownTypeNames, projectTypes)
                typeMirror.typeArguments.forEach { argument ->
                    collectProjectTypeNames(argument, knownTypeNames, projectTypes, visited)
                }
            }

            is ArrayType -> collectProjectTypeNames(typeMirror.componentType, knownTypeNames, projectTypes, visited)
            is TypeVariable -> {
                collectProjectTypeNames(typeMirror.upperBound, knownTypeNames, projectTypes, visited)
                collectProjectTypeNames(typeMirror.lowerBound, knownTypeNames, projectTypes, visited)
            }

            is WildcardType -> {
                collectProjectTypeNames(typeMirror.extendsBound, knownTypeNames, projectTypes, visited)
                collectProjectTypeNames(typeMirror.superBound, knownTypeNames, projectTypes, visited)
            }

            is IntersectionType -> typeMirror.bounds.forEach { bound ->
                collectProjectTypeNames(bound, knownTypeNames, projectTypes, visited)
            }

            is UnionType -> typeMirror.alternatives.forEach { alternative ->
                collectProjectTypeNames(alternative, knownTypeNames, projectTypes, visited)
            }
        }
    }

    private fun collectTypeNames(
        typeMirror: TypeMirror?,
        typeNames: MutableSet<String>
    ) {
        collectTypeNames(
            typeMirror = typeMirror,
            typeNames = typeNames,
            visited = Collections.newSetFromMap(IdentityHashMap())
        )
    }

    private fun collectTypeNames(
        typeMirror: TypeMirror?,
        typeNames: MutableSet<String>,
        visited: MutableSet<TypeMirror>
    ) {
        if (typeMirror == null || !visited.add(typeMirror)) {
            return
        }
        when (typeMirror) {
            is DeclaredType -> {
                addTypeName(typeMirror.asElement(), typeNames)
                typeMirror.typeArguments.forEach { argument ->
                    collectTypeNames(argument, typeNames, visited)
                }
            }

            is ArrayType -> collectTypeNames(typeMirror.componentType, typeNames, visited)
            is TypeVariable -> {
                collectTypeNames(typeMirror.upperBound, typeNames, visited)
                collectTypeNames(typeMirror.lowerBound, typeNames, visited)
            }

            is WildcardType -> {
                collectTypeNames(typeMirror.extendsBound, typeNames, visited)
                collectTypeNames(typeMirror.superBound, typeNames, visited)
            }

            is IntersectionType -> typeMirror.bounds.forEach { bound ->
                collectTypeNames(bound, typeNames, visited)
            }

            is UnionType -> typeMirror.alternatives.forEach { alternative ->
                collectTypeNames(alternative, typeNames, visited)
            }
        }
    }

}
