package buildlogic.cleanup

import java.io.File
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerDeleteEmptySourceDirectoriesTask(): TaskProvider<Task> =
    tasks.register("deleteEmptySourceDirectories") {
        group = "build setup"
        description = "Delete empty source directories left behind by refactors."

        val projectRoot = layout.projectDirectory.asFile.toPath()
        val sourceRoots = listOf("src", "resources")

        doLast {
            val deletedDirectories = sourceRoots.asSequence()
                .map(layout.projectDirectory::dir)
                .map { it.asFile }
                .filter(File::exists)
                .flatMap { root ->
                    root.walkBottomUp()
                        .filter(File::isDirectory)
                        .filter { directory -> directory != root }
                        .filter { directory -> directory.listFiles()?.isEmpty() == true }
                        .onEach(File::delete)
                        .map { directory -> projectRoot.relativize(directory.toPath()).toString().replace('\\', '/') }
                }
                .sorted()
                .toList()

            if (deletedDirectories.isNotEmpty()) {
                logger.lifecycle(
                    "Deleted empty source directories:\n{}",
                    deletedDirectories.joinToString(separator = "\n") { " - $it" }
                )
            }
        }
    }
