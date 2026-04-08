package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider

class ApplicationTaskSupport(private val project: Project) {
    fun registerJavaExecTask(
        taskName: String,
        taskDescription: String,
        taskMainClass: String,
        dependsOnTask: TaskProvider<*>? = null,
        taskArgs: List<String> = emptyList()
    ): TaskProvider<JavaExec> = project.tasks.register(taskName, JavaExec::class.java) {
        group = "application"
        description = taskDescription
        classpath = project.extensions.getByType(SourceSetContainer::class.java).named("main").get().runtimeClasspath
        mainClass.set(taskMainClass)
        if (dependsOnTask != null) {
            dependsOn(dependsOnTask)
        }
        if (taskArgs.isNotEmpty()) {
            args(taskArgs)
        }
    }
}
