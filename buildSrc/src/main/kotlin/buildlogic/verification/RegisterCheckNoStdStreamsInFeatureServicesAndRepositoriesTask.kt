package buildlogic.verification

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckNoStdStreamsInFeatureServicesAndRepositoriesTask(): TaskProvider<Task> =
    tasks.register("checkNoStdStreamsInFeatureServicesAndRepositories") {
        group = "verification"
        description = "Legacy guard for System.out/System.err usage in legacy feature service/repository packages."
        val stdStreamPattern = Regex("""System\.(?:out|err)\.println\(""")
        val projectRoot = layout.projectDirectory.asFile.toPath()

        doLast {
            val offenders = fileTree("src/features") {
                include("**/service/**/*.java")
                include("**/repository/**/*.java")
            }.files
                .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
                .filter { path -> stdStreamPattern.containsMatchIn(file(path).readText()) }
                .sorted()

            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { " - $it" }
                throw GradleException(
                    "New System.out/System.err usage detected in feature service/repository code.\n" +
                        "Use structured logging or UI/service-level error reporting helpers.\n" +
                        "Offending files:\n$details"
                )
            }
        }
    }
