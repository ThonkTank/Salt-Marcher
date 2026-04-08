package buildlogic.verification

import java.nio.file.Files
import java.nio.file.Path
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckNoCompiledArtifactsInSourceTask(): TaskProvider<Task> = tasks.register("checkNoCompiledArtifactsInSource") {
    group = "verification"
    description = "Fail if compiled .class artifacts are present inside src/."
    val sourceRoot = layout.projectDirectory.dir("src").asFile.toPath()

    doLast {
        val offendingFiles = Files.walk(sourceRoot)
            .use { paths: java.util.stream.Stream<Path> ->
                paths
                    .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".class") }
                    .map { sourceRoot.relativize(it).toString().replace('\\', '/') }
                    .sorted()
                    .toList()
            }

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - src/$it" }
            throw GradleException(
                "Compiled artifacts found in src/.\n" +
                    "Remove them with: find src -name '*.class' -delete\n" +
                    "Offending files:\n$details"
            )
        }
    }
}
