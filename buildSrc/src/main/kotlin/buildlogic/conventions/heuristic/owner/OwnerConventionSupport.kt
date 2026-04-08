package buildlogic.conventions.heuristic.owner

import java.io.File
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

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
    val parsedTypesByName: Map<String, OwnerConventionParsedJavaType>
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
        typeRef: String,
        sourcePackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): Set<String> {
        val projectPackages = linkedSetOf<String>()
        val fqcnPattern = Regex("""\b[a-z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][A-Za-z0-9_]*)*\.[A-Z][A-Za-z0-9_]*\b""")
        fqcnPattern.findAll(typeRef).forEach { match ->
            val fqcn = match.value
            val resolvedTypeName = resolveKnownTopLevelTypeName(fqcn, knownTypeNames)
            if (resolvedTypeName != null) {
                projectPackages += resolvedTypeName.substringBeforeLast('.')
            }
        }
        val nestedSimplePattern = Regex("""\b([A-Z][A-Za-z0-9_]*)\.[A-Z][A-Za-z0-9_]*\b""")
        nestedSimplePattern.findAll(typeRef).forEach { match ->
            val outerSimpleName = match.groupValues[1]
            val importedFqcn = typeImports.explicitTypes[outerSimpleName]
            val candidates = buildList {
                if (importedFqcn != null) {
                    add(importedFqcn)
                } else {
                    add("$sourcePackage.$outerSimpleName")
                    typeImports.wildcardPackages.forEach { wildcardPackage ->
                        add("$wildcardPackage.$outerSimpleName")
                    }
                }
            }
            candidates.firstNotNullOfOrNull { candidate ->
                resolveKnownTopLevelTypeName(candidate, knownTypeNames)
            }?.let { fqcn ->
                projectPackages += fqcn.substringBeforeLast('.')
            }
        }
        val simplePattern = Regex("""\b[A-Z][A-Za-z0-9_]*\b""")
        simplePattern.findAll(typeRef).forEach { match ->
            val simpleName = match.value
            val importedFqcn = typeImports.explicitTypes[simpleName]
            val candidates = buildList {
                if (importedFqcn != null) {
                    add(importedFqcn)
                } else {
                    add("$sourcePackage.$simpleName")
                    typeImports.wildcardPackages.forEach { wildcardPackage ->
                        add("$wildcardPackage.$simpleName")
                    }
                }
            }
            candidates.firstNotNullOfOrNull { candidate ->
                resolveKnownTopLevelTypeName(candidate, knownTypeNames)
            }?.let { fqcn ->
                projectPackages += fqcn.substringBeforeLast('.')
            }
        }
        return projectPackages
    }

    internal fun projectTypeNames(
        typeRef: String,
        sourcePackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): Set<String> {
        val projectTypes = linkedSetOf<String>()
        val fqcnPattern = Regex("""\b[a-z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][A-Za-z0-9_]*)*\.[A-Z][A-Za-z0-9_]*\b""")
        fqcnPattern.findAll(typeRef).forEach { match ->
            val fqcn = match.value
            resolveKnownTopLevelTypeName(fqcn, knownTypeNames)?.let(projectTypes::add)
        }
        val nestedSimplePattern = Regex("""\b([A-Z][A-Za-z0-9_]*)\.[A-Z][A-Za-z0-9_]*\b""")
        nestedSimplePattern.findAll(typeRef).forEach { match ->
            val outerSimpleName = match.groupValues[1]
            val importedFqcn = typeImports.explicitTypes[outerSimpleName]
            val candidates = buildList {
                if (importedFqcn != null) {
                    add(importedFqcn)
                } else {
                    add("$sourcePackage.$outerSimpleName")
                    typeImports.wildcardPackages.forEach { wildcardPackage ->
                        add("$wildcardPackage.$outerSimpleName")
                    }
                }
            }
            candidates.firstNotNullOfOrNull { candidate ->
                resolveKnownTopLevelTypeName(candidate, knownTypeNames)
            }?.let(projectTypes::add)
        }
        val simplePattern = Regex("""\b[A-Z][A-Za-z0-9_]*\b""")
        simplePattern.findAll(typeRef).forEach { match ->
            val simpleName = match.value
            val importedFqcn = typeImports.explicitTypes[simpleName]
            val candidates = buildList {
                if (importedFqcn != null) {
                    add(importedFqcn)
                } else {
                    add("$sourcePackage.$simpleName")
                    typeImports.wildcardPackages.forEach { wildcardPackage ->
                        add("$wildcardPackage.$simpleName")
                    }
                }
            }
            candidates.firstNotNullOfOrNull { candidate ->
                resolveKnownTopLevelTypeName(candidate, knownTypeNames)
            }?.let(projectTypes::add)
        }
        return projectTypes
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
        typeRef: String,
        sourcePackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): String? {
        return projectTypeNames(typeRef, sourcePackage, typeImports, knownTypeNames).singleOrNull()
    }

    internal fun ownerRequestMethodNames(ownerPackage: String, snapshot: OwnerConventionSnapshot): Set<String> {
        return snapshot.requestStemsByOwner[ownerPackage].orEmpty()
            .map { stem -> stem.replaceFirstChar(Char::lowercase) }
            .toSet()
    }

    internal fun ownerRequestTaskTypeName(ownerPackage: String, requestStem: String): String {
        return "$ownerPackage.$taskRole.${requestStem}Task"
    }

    internal fun parsedType(typeName: String, snapshot: OwnerConventionSnapshot): OwnerConventionParsedJavaType? {
        return snapshot.parsedTypesByName[typeName]
    }

    private fun offenders(
        applicableRoles: Set<String>?,
        reasonCollector: (OwnerConventionSourceFile, OwnerConventionSnapshot) -> List<String>
    ): List<String> {
        val snapshot = snapshot()
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

    private fun snapshot(): OwnerConventionSnapshot {
        val touchedPaths = touchedJavaPaths()
        if (touchedPaths.isEmpty()) {
            return OwnerConventionSnapshot(
                touchedPaths = emptySet(),
                knownPackages = emptySet(),
                knownTypeNames = emptySet(),
                requestStemsByOwner = emptyMap(),
                parsedSourcesByPath = emptyMap(),
                parsedTypesByName = emptyMap()
            )
        }
        val allSourceFiles = project.fileTree("src") {
            include("**/*.java")
            exclude("**/package-info.java")
        }.files.sortedBy(File::getPath)
        val parsedSourcesByPath = parseOwnerConventionJavaSources(projectRoot, allSourceFiles)
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
        val requestStemsByOwner = parsedSourcesByPath.values
            .mapNotNull { parsedSource ->
                val packageName = parsedSource.packageName ?: return@mapNotNull null
                val role = roleForDirectoryName(parsedSource.file.parentFile.name)
                if (role != ownerRole || !parsedSource.file.name.endsWith("Object.java")) {
                    return@mapNotNull null
                }
                val typeImports = parseTypeImports(parsedSource.importDeclarations, knownPackages)
                val ownerPackage = ownerPackageFor(packageName, role)
                val requestStems = parsedSource.topLevelTypes
                    .flatMap(OwnerConventionParsedJavaType::methods)
                    .filter { method -> isOwnerRequestShape(method, packageName, ownerPackage, typeImports, knownTypeNames) }
                    .mapNotNull { method -> requestStemForMethod(method.name) }
                    .toSet()
                ownerPackage to requestStems
            }
            .groupBy({ (ownerPackage, _) -> ownerPackage }, { (_, stems) -> stems })
            .mapValues { (_, stemSets) -> stemSets.flatten().toSet() }
        return OwnerConventionSnapshot(
            touchedPaths = touchedPaths,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            requestStemsByOwner = requestStemsByOwner,
            parsedSourcesByPath = parsedSourcesByPath,
            parsedTypesByName = parsedTypesByName
        )
    }

    private fun touchedSourceFiles(snapshot: OwnerConventionSnapshot): List<OwnerConventionSourceFile> {
        return snapshot.touchedPaths.asSequence()
            .mapNotNull { path ->
                val parsedSource = snapshot.parsedSourcesByPath[path] ?: return@mapNotNull null
                val packageName = parsedSource.packageName ?: packageNameFor(parsedSource.file.parentFile)
                val roleDeduction = deduceRole(parsedSource.file.parentFile)
                val typeImports = parseTypeImports(parsedSource.importDeclarations, snapshot.knownPackages)
                OwnerConventionSourceFile(
                    context = OwnerConventionSourceContext(
                        path = path,
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
            .toList()
    }

    private fun touchedJavaPaths(): Set<String> {
        val mergeBase = gitStdout("merge-base", "HEAD", "origin/main")
        val changed = linkedSetOf<String>()
        listOf(
            gitLines("diff", "--name-only", "--diff-filter=ACMR", "$mergeBase..HEAD", "--", "src"),
            gitLines("diff", "--name-only", "--cached", "--diff-filter=ACMR", "--", "src"),
            gitLines("diff", "--name-only", "--diff-filter=ACMR", "--", "src"),
            gitLines("ls-files", "--others", "--exclude-standard", "--", "src")
        ).forEach { lines ->
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

    private fun parseTypeImports(importDeclarations: List<String>, knownPackages: Set<String>): OwnerConventionTypeImports {
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

    private fun isOwnerRequestShape(
        method: OwnerConventionParsedJavaMethod,
        packageName: String,
        ownerPackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): Boolean {
        val requestStem = requestStemForMethod(method.name) ?: return false
        if (!method.modifiers.contains(javax.lang.model.element.Modifier.PUBLIC)) {
            return false
        }
        if (method.modifiers.contains(javax.lang.model.element.Modifier.STATIC)) {
            return false
        }
        if (method.parameters.size != 1) {
            return false
        }
        val expectedInputType = "$ownerPackage.$inputRole.${requestStem}Input"
        val parameterTypes = projectTypeNames(method.parameters.single().typeRef, packageName, typeImports, knownTypeNames)
        if (parameterTypes != setOf(expectedInputType)) {
            return false
        }
        val returnPackages = projectTypePackages(method.returnTypeRef ?: "void", packageName, typeImports, knownTypeNames)
        return returnPackages.all { projectPackage -> roleForDirectoryName(projectPackage.substringAfterLast('.')) == inputRole }
    }
}
