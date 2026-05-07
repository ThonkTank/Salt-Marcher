package saltmarcher.buildlogic.verification

import java.io.File
import org.gradle.api.Project
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.file.RegularFile
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.tasks.hygiene.JqassistantAnalyzeTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantCommandTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantScanTask

data class JqassistantTaskPair(
    val scanTask: TaskProvider<JqassistantScanTask>,
    val analyzeTask: TaskProvider<JqassistantAnalyzeTask>
)

internal class JqassistantTaskRegistrar(
    private val project: Project,
    private val cliFile: Provider<RegularFile>,
    private val jvmOpens: String,
    private val installJqassistant: TaskProvider<*>
) {
    fun registerTaskPair(
        scanTaskName: String,
        analyzeTaskName: String,
        scanDescription: String,
        analyzeDescription: String,
        ruleGroups: List<String>,
        rulesDirPaths: List<String>,
        mainClassesDirectory: Provider<Directory>,
        sourceRoots: FileCollection,
        storeDirectory: Provider<Directory>,
        reportsDirectory: Provider<Directory>,
        dependsOnTasks: List<Any>
    ): JqassistantTaskPair {
        val jqassistantRulesDirectories = rulesDirPaths.map(project::file)
        val scanTask = project.tasks.register<JqassistantScanTask>(scanTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = scanDescription
            dependsOn(installJqassistant)
            dependsOn(dependsOnTasks)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            rulesDirectories.from(jqassistantRulesDirectories)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            this.ruleGroups.set(ruleGroups)
            projectRoot.set(project.layout.projectDirectory)
            this.storeDirectory.set(storeDirectory)
        }
        val analyzeTask = project.tasks.register<JqassistantAnalyzeTask>(analyzeTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = analyzeDescription
            dependsOn(scanTask)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            rulesDirectories.from(jqassistantRulesDirectories)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            this.ruleGroups.set(ruleGroups)
            projectRoot.set(project.layout.projectDirectory)
            this.storeDirectory.set(storeDirectory)
            this.reportsDirectory.set(reportsDirectory)
        }
        return JqassistantTaskPair(scanTask, analyzeTask)
    }

    fun registerCommandTask(
        taskName: String,
        description: String,
        commandName: String,
        sourceConfigPath: String,
        rulesDirPaths: List<String>,
        mainClassesDirectory: Provider<Directory>,
        sourceRoots: FileCollection,
        dependsOnTasks: List<Any>
    ): TaskProvider<JqassistantCommandTask> {
        val jqassistantRulesDirectories = rulesDirPaths.map(project::file)
        val jqassistantRuleGroups = loadJqassistantRuleGroups(project.file(sourceConfigPath))
        return project.tasks.register<JqassistantCommandTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            this.description = description
            dependsOn(installJqassistant)
            dependsOn(dependsOnTasks)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            rulesDirectories.from(jqassistantRulesDirectories)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            this.ruleGroups.set(jqassistantRuleGroups)
            projectRoot.set(project.layout.projectDirectory)
            this.commandName.set(commandName)
        }
    }
}

internal fun loadJqassistantRuleGroups(configFile: File): List<String> {
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
