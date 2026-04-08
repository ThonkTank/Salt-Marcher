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

data class OwnerConventionMethodShape(
    val name: String,
    val returnType: String,
    val parameterTypes: List<String>,
    val isStatic: Boolean
)

data class OwnerConventionSnapshot(
    val touchedPaths: Set<String>,
    val knownPackages: Set<String>,
    val knownTypeNames: Set<String>,
    val requestStemsByOwner: Map<String, Set<String>>
)

data class OwnerConventionSourceFile(
    val context: OwnerConventionSourceContext,
    val sourceText: String,
    val declaredPackage: String?,
    val placementIssues: List<String>
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
    private val explicitImportPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
    private val packagePattern = Regex("""^\s*package\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
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

    internal fun sourcePlacementReasons(sourceFile: OwnerConventionSourceFile): List<String> {
        val reasons = mutableListOf<String>()
        val expectedPackage = packageNameFor(sourceFile.context.file.parentFile)
        if (sourceFile.declaredPackage != expectedPackage) {
            reasons += "${sourceFile.context.path} :: package must match the filesystem grammar exactly ($expectedPackage)"
        }
        sourceFile.placementIssues.forEach { issue ->
            reasons += "${sourceFile.context.path} :: $issue"
        }
        if (sourceFile.context.role == bucketRole) {
            reasons += "${sourceFile.context.path} :: *Bucket directories must not contain Java files"
        }
        return reasons
    }

    internal fun ownerFileReasons(
        context: OwnerConventionSourceContext,
        sourceText: String,
        knownTypeNames: Set<String>
    ): List<String> {
        val reasons = mutableListOf<String>()
        val siblingJavaFiles = directChildren(context.file.parentFile)
            .filter { child -> child.isFile && child.name.endsWith(".java") && child.name != "package-info.java" }
        if (!context.className.endsWith("Object.java")) {
            reasons += "${context.path} :: owner files must be named *Object"
        }
        if (normalizedToken(context.className.removeSuffix(".java").removeSuffix("Object")) != normalizedToken(context.dirName)) {
            reasons += "${context.path} :: owner file name must match its directory name"
        }
        if (siblingJavaFiles.size != 1 || siblingJavaFiles.single().canonicalFile != context.file.canonicalFile) {
            reasons += "${context.path} :: owner directories may contain exactly one Java file"
        }
        val className = context.className.removeSuffix(".java")
        if (!Regex("""(?m)^\s*public\s+final\s+class\s+$className\b""").containsMatchIn(sourceText)) {
            reasons += "${context.path} :: owner files must declare a public final class named $className"
        }
        context.typeImports.importedPackages.forEach { importedPackage ->
            val targetRole = roleForDirectoryName(importedPackage.substringAfterLast('.'))
            val allowed = when {
                sameOwner(context.ownerPackage, importedPackage) ->
                    targetRole in setOf(inputRole, taskRole, stateRole, repositoryRole)
                targetRole == ownerRole -> true
                targetRole == inputRole -> true
                else -> false
            }
            if (!allowed) {
                reasons += "${context.path} -> $importedPackage :: owner files may import only own input/task/state/repository plus foreign owner roots and foreign input"
            }
        }
        publicMethods(sourceText).forEach { method ->
            val paramPackages = method.parameterTypes.flatMap { type ->
                projectTypePackages(type, context.packageName, context.typeImports, knownTypeNames)
            }
            val returnPackages = projectTypePackages(method.returnType, context.packageName, context.typeImports, knownTypeNames)
            (paramPackages + returnPackages).distinct().forEach { projectPackage ->
                if (roleForDirectoryName(projectPackage.substringAfterLast('.')) != inputRole) {
                    reasons += "${context.path} :: owner public methods may expose only input types from project code"
                }
            }
        }
        return reasons
    }

    internal fun inputFileReasons(
        context: OwnerConventionSourceContext,
        sourceText: String,
        requestStemsByOwner: Map<String, Set<String>>
    ): List<String> {
        val reasons = mutableListOf<String>()
        val className = context.className.removeSuffix(".java")
        val requestStem = requestStemFor(context.className, "Input")
        if (requestStem == null) {
            reasons += "${context.path} :: input files must be named <Request>Input with a direct request stem"
        } else if (requestStem !in requestStemsByOwner[context.ownerPackage].orEmpty()) {
            reasons += "${context.path} :: input files must match a real public request on ${context.ownerPackage}.${ownerObjectName(context.ownerPackage)}"
        }
        val isRecord = Regex("""(?m)^\s*(public\s+)?record\s+$className\b""").containsMatchIn(sourceText)
        val isEnum = Regex("""(?m)^\s*(public\s+)?enum\s+$className\b""").containsMatchIn(sourceText)
        val isSealedInterface = Regex("""(?m)^\s*(public\s+)?sealed\s+interface\s+$className\b""").containsMatchIn(sourceText)
        if (!(isRecord || isEnum || isSealedInterface)) {
            reasons += "${context.path} :: input files must declare a record, enum, or sealed interface"
        }
        context.typeImports.importedPackages.forEach { importedPackage ->
            if (roleForDirectoryName(importedPackage.substringAfterLast('.')) != inputRole) {
                reasons += "${context.path} -> $importedPackage :: input files may import only other input packages from project code"
            }
        }
        return reasons
    }

    internal fun taskFileReasons(
        context: OwnerConventionSourceContext,
        sourceText: String,
        knownTypeNames: Set<String>,
        requestStemsByOwner: Map<String, Set<String>>
    ): List<String> {
        val reasons = mutableListOf<String>()
        val className = context.className.removeSuffix(".java")
        val requestStem = requestStemFor(context.className, "Task")
        if (requestStem == null) {
            reasons += "${context.path} :: task files must be named <Request>Task with a direct request stem"
        } else if (requestStem !in requestStemsByOwner[context.ownerPackage].orEmpty()) {
            reasons += "${context.path} :: task files must match a real public request on ${context.ownerPackage}.${ownerObjectName(context.ownerPackage)}"
        }
        val isFinalClass = Regex("""(?m)^\s*(public\s+)?final\s+class\s+$className\b""").containsMatchIn(sourceText)
        val hasPrivateConstructor = Regex("""(?m)^\s*private\s+$className\s*\(""").containsMatchIn(sourceText)
        val hasPublicConstructor = Regex("""(?m)^\s*public\s+$className\s*\(""").containsMatchIn(sourceText)
        if (!isFinalClass) {
            reasons += "${context.path} :: task files must declare a final class"
        }
        if (!hasPrivateConstructor || hasPublicConstructor) {
            reasons += "${context.path} :: task files must hide construction behind a private constructor"
        }
        context.typeImports.importedPackages.forEach { importedPackage ->
            if (roleForDirectoryName(importedPackage.substringAfterLast('.')) != inputRole) {
                reasons += "${context.path} -> $importedPackage :: task files may import only input packages from project code"
            }
        }
        val methods = publicMethods(sourceText)
        val publicStaticMethods = methods.filter(OwnerConventionMethodShape::isStatic)
        val publicInstanceMethods = methods.filterNot(OwnerConventionMethodShape::isStatic)
        if (publicStaticMethods.size != 1) {
            reasons += "${context.path} :: task files must expose exactly one public static method"
        }
        if (publicInstanceMethods.isNotEmpty()) {
            reasons += "${context.path} :: task files must not expose public instance methods"
        }
        publicStaticMethods.singleOrNull()?.let { method ->
            if (method.parameterTypes.size != 1) {
                reasons += "${context.path} :: task files must model exactly one input parameter"
            }
            val paramPackages = method.parameterTypes.flatMap { type ->
                projectTypePackages(type, context.packageName, context.typeImports, knownTypeNames)
            }.distinct()
            val returnPackages = projectTypePackages(method.returnType, context.packageName, context.typeImports, knownTypeNames)
            if (paramPackages.size != 1 || paramPackages.any { projectPackage ->
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) != inputRole
                }
            ) {
                reasons += "${context.path} :: task methods must accept exactly one project input type"
            }
            if (requestStem != null) {
                val paramTypes = method.parameterTypes.flatMap { type ->
                    projectTypeNames(type, context.packageName, context.typeImports, knownTypeNames)
                }.distinct()
                val expectedInputType = "${context.ownerPackage}.input.${requestStem}Input"
                if (paramTypes != listOf(expectedInputType)) {
                    reasons += "${context.path} :: task methods must accept exactly ${requestStem}Input from the same owner"
                }
            }
            if (returnPackages.size != 1 || returnPackages.any { projectPackage ->
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) != inputRole
                }
            ) {
                reasons += "${context.path} :: task methods must return exactly one project input type"
            }
        }
        return reasons
    }

    internal fun stateFileReasons(
        context: OwnerConventionSourceContext,
        sourceText: String,
        knownTypeNames: Set<String>
    ): List<String> {
        val reasons = mutableListOf<String>()
        val className = context.className.removeSuffix(".java")
        val isRecord = Regex("""(?m)^\s*(public\s+)?record\s+$className\b""").containsMatchIn(sourceText)
        val isEnum = Regex("""(?m)^\s*(public\s+)?enum\s+$className\b""").containsMatchIn(sourceText)
        val isFinalClass = Regex("""(?m)^\s*(public\s+)?final\s+class\s+$className\b""").containsMatchIn(sourceText)
        if (!(isRecord || isEnum || isFinalClass)) {
            reasons += "${context.path} :: state files must declare a final class, record, or enum"
        }
        if (isFinalClass && Regex("""(?m)^\s*public\s+$className\s*\(""").containsMatchIn(sourceText)) {
            reasons += "${context.path} :: state classes must use factory or transition methods instead of public constructors"
        }
        context.typeImports.importedPackages.forEach { importedPackage ->
            val importedRole = roleForDirectoryName(importedPackage.substringAfterLast('.'))
            val allowed = sameOwner(context.ownerPackage, importedPackage) && importedRole in setOf(inputRole, stateRole)
            if (!allowed) {
                reasons += "${context.path} -> $importedPackage :: state files may import only own input and own state packages"
            }
        }
        val methods = publicMethods(sourceText)
        if (methods.any { !it.isStatic }) {
            reasons += "${context.path} :: state files must not expose public instance methods"
        }
        methods.filter(OwnerConventionMethodShape::isStatic).forEach { method ->
            val paramPackages = method.parameterTypes.flatMap { type ->
                projectTypePackages(type, context.packageName, context.typeImports, knownTypeNames)
            }.distinct()
            val returnPackages = projectTypePackages(method.returnType, context.packageName, context.typeImports, knownTypeNames)
            if (paramPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) !in setOf(inputRole, stateRole)
                }
            ) {
                reasons += "${context.path} :: state factories may accept only own input and own state types"
            }
            if (returnPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: state factories may return only own state types"
            }
        }
        return reasons
    }

    internal fun repositoryFileReasons(
        context: OwnerConventionSourceContext,
        sourceText: String,
        knownTypeNames: Set<String>
    ): List<String> {
        val reasons = mutableListOf<String>()
        val className = context.className.removeSuffix(".java")
        val isFinalClass = Regex("""(?m)^\s*(public\s+)?final\s+class\s+$className\b""").containsMatchIn(sourceText)
        val hasPrivateConstructor = Regex("""(?m)^\s*private\s+$className\s*\(""").containsMatchIn(sourceText)
        val hasPublicConstructor = Regex("""(?m)^\s*public\s+$className\s*\(""").containsMatchIn(sourceText)
        if (!isFinalClass) {
            reasons += "${context.path} :: repository files must declare a final class"
        }
        if (!hasPrivateConstructor || hasPublicConstructor) {
            reasons += "${context.path} :: repository files must hide construction behind a private constructor"
        }
        context.typeImports.importedPackages.forEach { importedPackage ->
            val importedRole = roleForDirectoryName(importedPackage.substringAfterLast('.'))
            val allowed = sameOwner(context.ownerPackage, importedPackage) && importedRole == stateRole
            if (!allowed) {
                reasons += "${context.path} -> $importedPackage :: repository files may import only own state packages from project code"
            }
        }
        val methods = publicMethods(sourceText)
        if (methods.none(OwnerConventionMethodShape::isStatic)) {
            reasons += "${context.path} :: repository files must expose public static persistence methods"
        }
        if (methods.any { !it.isStatic }) {
            reasons += "${context.path} :: repository files must not expose public instance methods"
        }
        methods.filter(OwnerConventionMethodShape::isStatic).forEach { method ->
            val paramPackages = method.parameterTypes.flatMap { type ->
                projectTypePackages(type, context.packageName, context.typeImports, knownTypeNames)
            }.distinct()
            val returnPackages = projectTypePackages(method.returnType, context.packageName, context.typeImports, knownTypeNames)
            if (paramPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may accept only own state types from project code"
            }
            if (returnPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may return only own state types from project code"
            }
        }
        return reasons
    }

    internal fun ownerConventionOffenders(
        applicableRoles: Set<String>? = null,
        reasonCollector: (OwnerConventionSourceFile, OwnerConventionSnapshot) -> List<String>
    ): List<String> = offenders(applicableRoles, reasonCollector)

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
                requestStemsByOwner = emptyMap()
            )
        }
        val knownPackages = project.fileTree("src") {
            include("**/*.java")
        }.files
            .mapNotNull { sourceFile ->
                packagePattern.find(sourceFile.readText())?.groupValues?.get(1)
            }
            .toSet()
        val knownTypeNames = project.fileTree("src") {
            include("**/*.java")
            exclude("**/package-info.java")
        }.files
            .mapNotNull { sourceFile ->
                val packageName = packagePattern.find(sourceFile.readText())?.groupValues?.get(1) ?: return@mapNotNull null
                "$packageName.${sourceFile.nameWithoutExtension}"
            }
            .toSet()
        val requestStemsByOwner = project.fileTree("src") {
            include("**/*.java")
            exclude("**/package-info.java")
        }.files
            .mapNotNull { sourceFile ->
                val sourceText = sourceFile.readText()
                val packageName = packagePattern.find(sourceText)?.groupValues?.get(1) ?: return@mapNotNull null
                val role = roleForDirectoryName(sourceFile.parentFile.name)
                if (role != ownerRole || !sourceFile.name.endsWith("Object.java")) {
                    return@mapNotNull null
                }
                ownerPackageFor(packageName, role) to publicMethods(sourceText)
                    .mapNotNull { method -> requestStemForMethod(method.name) }
                    .toSet()
            }
            .groupBy({ (ownerPackage, _) -> ownerPackage }, { (_, stems) -> stems })
            .mapValues { (_, stemSets) -> stemSets.flatten().toSet() }
        return OwnerConventionSnapshot(
            touchedPaths = touchedPaths,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            requestStemsByOwner = requestStemsByOwner
        )
    }

    private fun touchedSourceFiles(snapshot: OwnerConventionSnapshot): List<OwnerConventionSourceFile> {
        return project.fileTree("src") {
            include("**/*.java")
        }.files
            .asSequence()
            .map { sourceFile ->
                val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                path to sourceFile
            }
            .filter { (path, _) -> path in snapshot.touchedPaths }
            .map { (path, sourceFile) ->
                val sourceText = sourceFile.readText()
                val declaredPackage = packagePattern.find(sourceText)?.groupValues?.get(1)
                val packageName = declaredPackage ?: packageNameFor(sourceFile.parentFile)
                val roleDeduction = deduceRole(sourceFile.parentFile)
                OwnerConventionSourceFile(
                    context = OwnerConventionSourceContext(
                        path = path,
                        file = sourceFile,
                        packageName = packageName,
                        dirName = sourceFile.parentFile.name,
                        role = roleDeduction.role,
                        ownerPackage = ownerPackageFor(packageName, roleDeduction.role),
                        className = sourceFile.name,
                        typeImports = parseTypeImports(sourceText, snapshot.knownPackages)
                    ),
                    sourceText = sourceText,
                    declaredPackage = declaredPackage,
                    placementIssues = roleDeduction.issues
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
            throw GradleException(
                "Git command failed (${args.joinToString(" ")}).\n$output"
            )
        }
        return output.trim()
    }

    private fun gitLines(vararg args: String): List<String> {
        return gitStdout(*args)
            .lines()
            .map(String::trim)
            .filter(String::isNotBlank)
    }

    private fun normalizedToken(token: String): String {
        return token.filter(Char::isLetterOrDigit).lowercase()
    }

    private fun requestStemFor(fileName: String, expectedSuffix: String): String? {
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

    private fun requestStemForMethod(methodName: String): String? {
        if (!Regex("""[a-z][A-Za-z0-9]*""").matches(methodName)) {
            return null
        }
        val stem = methodName.replaceFirstChar { ch -> ch.titlecase() }
        if (reservedRequestStemSuffixes.any { reserved -> stem.endsWith(reserved) }) {
            return null
        }
        return stem
    }

    private fun ownerObjectName(ownerPackage: String): String {
        return ownerPackage.substringAfterLast('.').replaceFirstChar { it.titlecase() } + "Object"
    }

    private fun packageNameFor(file: File): String {
        return srcRelativeSegments(file).joinToString(".")
    }

    private fun srcRelativeSegments(file: File): List<String> {
        val relativePath = srcRootPath.relativize(file.toPath()).toString().replace('\\', '/')
        if (relativePath.isBlank()) {
            return emptyList()
        }
        return relativePath.split('/').filter(String::isNotBlank)
    }

    private fun directChildren(dir: File): List<File> {
        return dir.listFiles()?.sortedBy(File::getName).orEmpty()
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

    private fun roleForDirectoryName(name: String): String {
        return when (name) {
            inputRole -> inputRole
            taskRole -> taskRole
            repositoryRole -> repositoryRole
            stateRole -> stateRole
            else -> if (name.endsWith("Bucket")) bucketRole else ownerRole
        }
    }

    private fun ownerPackageFor(packageName: String, role: String): String {
        return when (role) {
            inputRole, taskRole, repositoryRole, stateRole, bucketRole -> packageName.substringBeforeLast('.', "")
            else -> packageName
        }
    }

    private fun sameOwner(sourceOwnerPackage: String, targetPackage: String): Boolean {
        val targetRole = roleForDirectoryName(targetPackage.substringAfterLast('.'))
        return ownerPackageFor(targetPackage, targetRole) == sourceOwnerPackage
    }

    private fun parseTypeImports(sourceText: String, knownPackages: Set<String>): OwnerConventionTypeImports {
        val explicitTypes = linkedMapOf<String, String>()
        val wildcardPackages = linkedSetOf<String>()
        val importedPackages = mutableListOf<String>()
        explicitImportPattern.findAll(sourceText)
            .map { match -> match.groupValues[1] }
            .forEach { imported ->
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

    private fun publicMethods(sourceText: String): List<OwnerConventionMethodShape> {
        val pattern = Regex(
            """(?m)^\s*public\s+(static\s+)?([A-Za-z0-9_<>\[\],.? ]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)"""
        )
        return pattern.findAll(sourceText)
            .map { match ->
                OwnerConventionMethodShape(
                    name = match.groupValues[3].trim(),
                    returnType = match.groupValues[2].trim(),
                    parameterTypes = splitTopLevelCommas(match.groupValues[4]).map(::parameterType),
                    isStatic = match.groupValues[1].isNotBlank()
                )
            }
            .toList()
    }

    private fun splitTopLevelCommas(raw: String): List<String> {
        if (raw.isBlank()) {
            return emptyList()
        }
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var depth = 0
        raw.forEach { ch ->
            when (ch) {
                '<' -> {
                    depth += 1
                    current.append(ch)
                }
                '>' -> {
                    depth = (depth - 1).coerceAtLeast(0)
                    current.append(ch)
                }
                ',' -> {
                    if (depth == 0) {
                        result += current.toString().trim()
                        current.setLength(0)
                    } else {
                        current.append(ch)
                    }
                }
                else -> current.append(ch)
            }
        }
        val tail = current.toString().trim()
        if (tail.isNotBlank()) {
            result += tail
        }
        return result
    }

    private fun parameterType(parameter: String): String {
        val cleaned = parameter
            .replace(Regex("""@\w+(?:\([^)]*\))?\s*"""), " ")
            .replace(Regex("""\bfinal\s+"""), "")
            .trim()
            .replace("...", "[]")
        val tokens = cleaned.split(Regex("""\s+""")).filter(String::isNotBlank)
        if (tokens.size < 2) {
            return cleaned
        }
        return tokens.dropLast(1).joinToString(" ")
    }

    private fun projectTypePackages(
        typeRef: String,
        sourcePackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): Set<String> {
        val projectPackages = linkedSetOf<String>()
        val fqcnPattern = Regex("""\b[a-z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][A-Za-z0-9_]*)*\.[A-Z][A-Za-z0-9_]*\b""")
        fqcnPattern.findAll(typeRef).forEach { match ->
            val fqcn = match.value
            if (fqcn in knownTypeNames) {
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
            candidates.firstOrNull { candidate -> candidate in knownTypeNames }?.let { fqcn ->
                projectPackages += fqcn.substringBeforeLast('.')
            }
        }
        return projectPackages
    }

    private fun projectTypeNames(
        typeRef: String,
        sourcePackage: String,
        typeImports: OwnerConventionTypeImports,
        knownTypeNames: Set<String>
    ): Set<String> {
        val projectTypes = linkedSetOf<String>()
        val fqcnPattern = Regex("""\b[a-z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][A-Za-z0-9_]*)*\.[A-Z][A-Za-z0-9_]*\b""")
        fqcnPattern.findAll(typeRef).forEach { match ->
            val fqcn = match.value
            if (fqcn in knownTypeNames) {
                projectTypes += fqcn
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
            candidates.firstOrNull { candidate -> candidate in knownTypeNames }?.let(projectTypes::add)
        }
        return projectTypes
    }
}

data class OwnerConventionRoleDeduction(
    val role: String,
    val issues: List<String>
)
