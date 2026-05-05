package saltmarcher.buildlogic.verification

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
        sourceConfigPath: String,
        rulesDirPath: String,
        mainClassesDirectory: Provider<Directory>,
        sourceRoots: FileCollection,
        storeDirectory: Provider<Directory>,
        reportsDirectory: Provider<Directory>,
        dependsOnTasks: List<Any>
    ): JqassistantTaskPair {
        val jqassistantSourceConfigFile = project.file(sourceConfigPath)
        val jqassistantRulesDirectory = project.file(rulesDirPath)
        val scanTask = project.tasks.register<JqassistantScanTask>(scanTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = scanDescription
            dependsOn(installJqassistant)
            dependsOn(dependsOnTasks)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            sourceConfigFile.set(jqassistantSourceConfigFile)
            rulesDirectory.set(jqassistantRulesDirectory)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            projectRoot.set(project.layout.projectDirectory)
            this.storeDirectory.set(storeDirectory)
        }
        val analyzeTask = project.tasks.register<JqassistantAnalyzeTask>(analyzeTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = analyzeDescription
            dependsOn(scanTask)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            sourceConfigFile.set(jqassistantSourceConfigFile)
            rulesDirectory.set(jqassistantRulesDirectory)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
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
        rulesDirPath: String,
        mainClassesDirectory: Provider<Directory>,
        sourceRoots: FileCollection,
        dependsOnTasks: List<Any>
    ): TaskProvider<JqassistantCommandTask> {
        val jqassistantSourceConfigFile = project.file(sourceConfigPath)
        val jqassistantRulesDirectory = project.file(rulesDirPath)
        return project.tasks.register<JqassistantCommandTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            this.description = description
            dependsOn(installJqassistant)
            dependsOn(dependsOnTasks)
            cliFile.set(this@JqassistantTaskRegistrar.cliFile)
            sourceConfigFile.set(jqassistantSourceConfigFile)
            rulesDirectory.set(jqassistantRulesDirectory)
            this.mainClassesDirectory.set(mainClassesDirectory)
            this.sourceRoots.from(sourceRoots)
            this.jvmOpens.set(this@JqassistantTaskRegistrar.jvmOpens)
            projectRoot.set(project.layout.projectDirectory)
            this.commandName.set(commandName)
        }
    }
}
