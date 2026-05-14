package saltmarcher.buildlogic.verification

import java.io.File
import org.gradle.api.Project
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.file.RegularFile
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.Sync
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.EnforcementJqassistantTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantAnalyzeTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantScanTask

data class JqassistantTaskPair(
    val scanTask: TaskProvider<JqassistantScanTask>,
    val analyzeTask: TaskProvider<JqassistantAnalyzeTask>
)

internal class JqassistantTaskRegistrar(
    private val project: Project,
    private val cliFile: Provider<RegularFile>,
    private val jvmOpens: String,
    private val installJqassistant: TaskProvider<Sync>?
) {
    fun registerTaskPair(
        bundleId: String,
        taskSpec: EnforcementJqassistantTask,
        mainClassesDirectory: Provider<Directory>,
        sourceRoots: FileCollection,
        dependsOnTasks: List<Any>
    ): JqassistantTaskPair {
        val scanTaskName = taskSpec.taskName.replaceFirst("Analyze", "Scan")
        val rulesDirectory = project.layout.projectDirectory.dir(taskSpec.rulesDirPath)
        val ruleGroups = loadJqassistantRuleGroups(project.file(taskSpec.sourceConfigPath))
        val storeDirectory = project.layout.buildDirectory.dir("tools/jqassistant/$bundleId/store")
        val reportsDirectory = project.layout.buildDirectory.dir("reports/jqassistant/$bundleId")
        val scanTask = project.tasks.register<JqassistantScanTask>(scanTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Scan SaltMarcher classes and source roots for ${taskSpec.description}"
            dependsOn(requireNotNull(installJqassistant) {
                "jQAssistant verification tasks require the jQAssistant install task."
            })
            dependsOn(dependsOnTasks)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            projectRoot.set(project.layout.projectDirectory)
            this.storeDirectory.set(storeDirectory)
        }
        val analyzeTask = project.tasks.register<JqassistantAnalyzeTask>(taskSpec.taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskSpec.description
            dependsOn(scanTask)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            this.rulesDirectory.set(rulesDirectory)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            this.ruleGroups.set(ruleGroups)
            projectRoot.set(project.layout.projectDirectory)
            this.storeDirectory.set(storeDirectory)
            this.reportsDirectory.set(reportsDirectory)
        }
        return JqassistantTaskPair(scanTask, analyzeTask)
    }
}

private fun loadJqassistantRuleGroups(configFile: File): List<String> {
    val groups = mutableListOf<String>()
    var insideGroups = false
    configFile.forEachLine { rawLine ->
        val line = rawLine.trim()
        when {
            line == "groups:" -> insideGroups = true
            insideGroups && line.startsWith("- ") -> groups += line.removePrefix("- ").trim()
            insideGroups && line.isNotEmpty() && !line.startsWith("#") -> insideGroups = false
        }
    }
    require(groups.isNotEmpty()) {
        "jQAssistant config '$configFile' must declare at least one analyze group."
    }
    return groups
}
