package saltmarcher.buildlogic.settings

import java.io.File
import org.gradle.api.GradleException
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
    val currentHooksPath = readGitConfig(repoRootDir, "--get", "core.hooksPath")
        ?.trim()
        ?.replace(File.separatorChar, '/')
    if (currentHooksPath == expectedHooksPath) {
        return
    }

    writeGitConfig(repoRootDir, "core.hooksPath", expectedHooksPath)
}

private fun readGitConfig(repoRootDir: File, vararg args: String): String? {
    return runCatching {
        val result = runGitConfig(repoRootDir, *args)
        if (result.exitCode == 0) result.output else null
    }.getOrNull()
}

private fun writeGitConfig(repoRootDir: File, vararg args: String) {
    val result = runGitConfig(repoRootDir, *args)
    if (result.exitCode != 0) {
        throw GradleException(
            "Failed to configure SaltMarcher versioned hooks in ${repoRootDir.path}: ${result.output.trim()}"
        )
    }
}

private data class GitConfigResult(val exitCode: Int, val output: String)

private fun runGitConfig(repoRootDir: File, vararg args: String): GitConfigResult {
    val process = ProcessBuilder(listOf("git", "config", "--local") + args)
        .directory(repoRootDir)
        .redirectErrorStream(true)
        .start()
    val output = process.inputStream.bufferedReader().use { reader -> reader.readText() }
    return GitConfigResult(process.waitFor(), output)
}

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
