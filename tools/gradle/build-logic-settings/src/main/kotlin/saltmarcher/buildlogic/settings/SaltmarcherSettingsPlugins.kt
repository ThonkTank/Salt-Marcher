package saltmarcher.buildlogic.settings

import java.io.File
import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings
import saltmarcher.buildlogic.shared.CheckTaskName
import saltmarcher.buildlogic.shared.FocusedHandoffTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffCompileIntegrityTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffHygieneTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffStructureTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffTaskName

class SaltmarcherRootSettingsPlugin : Plugin<Settings> {
    override fun apply(settings: Settings) {
        val discoveredRepoRootDir = findRepositoryRoot(settings.settingsDir)
        val repoRootDir = configuredRepositoryRoot(settings.settingsDir)
            ?: discoveredRepoRootDir
        System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)
        if (System.getenv("SALTMARCHER_PRE_COMMIT_GATE") != "1") {
            configureVersionedHooks(repoRootDir)
        }

        val requestedTaskNames = settings.gradle.startParameter.taskNames
            .map { taskName -> taskName.substringAfterLast(":") }
            .toSet()
        val requestScope = verificationRequestScope(
            requestedTaskNames,
            discoveryBuildRequest = requestedTaskNames.isEmpty() ||
                requestedTaskNames.any(::isDiscoveryTaskName)
        )

        System.setProperty("saltmarcher.includeBuildHarness", requestScope.includeBuildHarness.toString())
        System.setProperty("saltmarcher.includeQualityRules", requestScope.includeQualityRules.toString())
        System.setProperty("saltmarcher.includeQualityRulesErrorProne", requestScope.includeQualityRulesErrorProne.toString())
        System.setProperty("saltmarcher.discoveryBuildRequest", requestScope.discoveryBuildRequest.toString())

        if (requestScope.includeBuildHarness) {
            includeSaltmarcherBuild(settings, "tools/gradle/build-harness")
        }
        if (requestScope.includeQualityRules) {
            includeSaltmarcherBuild(settings, "tools/quality/rules/quality-rules")
        }
        if (requestScope.includeQualityRulesErrorProne) {
            includeSaltmarcherBuild(settings, "tools/quality/incubator/quality-rules-errorprone")
        }
    }
}

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) = settings.includeBuild(relativePath)

private fun configuredRepositoryRoot(settingsDir: File): File? {
    val configuredRoot = System.getProperty("saltmarcher.repoRootDir")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.let(::File)
        ?.canonicalFile
        ?: return null
    val canonicalSettingsDir = settingsDir.canonicalFile.toPath()
    if (!canonicalSettingsDir.startsWith(configuredRoot.toPath())) {
        return null
    }
    if (!File(configuredRoot, "AGENTS.md").isFile || !File(configuredRoot, "gradlew").isFile) {
        return null
    }
    return configuredRoot
}

private fun configureVersionedHooks(repoRootDir: File) {
    val hooksDir = File(repoRootDir, "tools/hooks")
    val gitEntry = File(repoRootDir, ".git")
    if (!hooksDir.isDirectory || !gitEntry.exists()) {
        return
    }

    val expectedHooksPath = "tools/hooks"
    val configFile = gitLocalConfigFile(gitEntry)
        ?: return
    val currentHooksPath = readCoreHooksPath(configFile)
        ?.trim()
        ?.replace(File.separatorChar, '/')
    if (currentHooksPath == expectedHooksPath) {
        return
    }

    writeCoreHooksPath(configFile, expectedHooksPath)
}

private fun gitLocalConfigFile(gitEntry: File): File? {
    if (gitEntry.isDirectory) {
        return File(gitEntry, "config")
    }
    if (!gitEntry.isFile) {
        return null
    }
    val gitDir = gitEntry.readLines()
        .firstOrNull()
        ?.substringAfter("gitdir:", missingDelimiterValue = "")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?: return null
    val resolvedGitDir = File(gitDir).takeIf(File::isAbsolute)
        ?: File(gitEntry.parentFile, gitDir)
    return File(resolvedGitDir.canonicalFile, "config")
}

private fun readCoreHooksPath(configFile: File): String? {
    if (!configFile.isFile) {
        return null
    }
    var inCoreSection = false
    for (line in configFile.readLines()) {
        val trimmed = line.trim()
        if (isGitConfigSection(trimmed)) {
            inCoreSection = isCoreSection(trimmed)
        } else if (inCoreSection && isHooksPathEntry(trimmed)) {
            return trimmed.substringAfter("=").trim().trim('"')
        }
    }
    return null
}

private fun writeCoreHooksPath(configFile: File, expectedHooksPath: String) {
    val lines = if (configFile.isFile) configFile.readLines() else emptyList()
    val rewritten = mutableListOf<String>()
    var inCoreSection = false
    var sawCoreSection = false
    var wroteHooksPath = false

    for (line in lines) {
        val trimmed = line.trim()
        if (isGitConfigSection(trimmed)) {
            if (inCoreSection && !wroteHooksPath) {
                rewritten.add("\thooksPath = $expectedHooksPath")
                wroteHooksPath = true
            }
            inCoreSection = isCoreSection(trimmed)
            sawCoreSection = sawCoreSection || inCoreSection
            rewritten.add(line)
        } else if (inCoreSection && isHooksPathEntry(trimmed)) {
            if (!wroteHooksPath) {
                rewritten.add("\thooksPath = $expectedHooksPath")
                wroteHooksPath = true
            }
        } else {
            rewritten.add(line)
        }
    }

    if (!sawCoreSection) {
        if (rewritten.isNotEmpty() && rewritten.last().isNotBlank()) {
            rewritten.add("")
        }
        rewritten.add("[core]")
        rewritten.add("\thooksPath = $expectedHooksPath")
    } else if (inCoreSection && !wroteHooksPath) {
        rewritten.add("\thooksPath = $expectedHooksPath")
    }

    configFile.parentFile.mkdirs()
    configFile.writeText(rewritten.joinToString(System.lineSeparator()) + System.lineSeparator())
}

private fun isGitConfigSection(trimmedLine: String): Boolean =
    trimmedLine.startsWith("[") && trimmedLine.endsWith("]")

private fun isCoreSection(trimmedLine: String): Boolean =
    trimmedLine.equals("[core]", ignoreCase = true)

private fun isHooksPathEntry(trimmedLine: String): Boolean =
    trimmedLine.substringBefore("=", missingDelimiterValue = "")
        .trim()
        .equals("hooksPath", ignoreCase = true)

private data class VerificationRequestScope(
    val includeBuildHarness: Boolean,
    val includeQualityRules: Boolean,
    val includeQualityRulesErrorProne: Boolean,
    val discoveryBuildRequest: Boolean
)

private fun verificationRequestScope(
    requestedTaskNames: Set<String>,
    discoveryBuildRequest: Boolean
): VerificationRequestScope {
    val broadProductionRequest = requestedTaskNames.any(::isBroadProductionTaskName)
    val productionHandoffStructureRequest = requestedTaskNames.any(::isProductionHandoffStructureTaskName)
    val documentationRequest = requestedTaskNames.any(::isDocumentationTaskName)
    val sourceHygieneRequest = requestedTaskNames.any(::isQualityRulesTaskName)
    val nearMissRequest = requestedTaskNames.any(::isNearMissTaskName)
    val buildHarnessRequest = requestedTaskNames.any(::isBuildHarnessTaskName)

    return VerificationRequestScope(
        includeBuildHarness = discoveryBuildRequest ||
            broadProductionRequest ||
            productionHandoffStructureRequest ||
            documentationRequest ||
            buildHarnessRequest,
        includeQualityRules = discoveryBuildRequest || broadProductionRequest || sourceHygieneRequest,
        includeQualityRulesErrorProne = discoveryBuildRequest || broadProductionRequest || nearMissRequest,
        discoveryBuildRequest = discoveryBuildRequest
    )
}

private fun isDiscoveryTaskName(taskName: String): Boolean =
    taskName == "help" ||
        taskName == "tasks" ||
        taskName == "projects" ||
        taskName == "properties" ||
        taskName == "dependencies" ||
        taskName == "dependencyInsight" ||
        taskName.startsWith("help")

private fun isBroadProductionTaskName(taskName: String): Boolean =
    taskName == ProductionHandoffTaskName ||
        taskName == ProductionHandoffHygieneTaskName ||
        taskName == CheckTaskName ||
        taskName == "build"

private fun isProductionHandoffStructureTaskName(taskName: String): Boolean =
    taskName == ProductionHandoffStructureTaskName

private fun isDocumentationTaskName(taskName: String): Boolean =
    taskName == "checkDocumentationEnforcement" ||
        taskName == "documentationEnforcementCheck"

private fun isQualityRulesTaskName(taskName: String): Boolean =
    taskName == "pmdMain" ||
        taskName == "pmdStrictMain" ||
        taskName == "cpdMain" ||
        taskName == "ckjmMain" ||
        isNearMissTaskName(taskName)

private fun isNearMissTaskName(taskName: String): Boolean =
    taskName == "checkRewriteNearMisses"

private fun isBuildHarnessTaskName(taskName: String): Boolean =
    taskName == "architectureCheck"

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}
