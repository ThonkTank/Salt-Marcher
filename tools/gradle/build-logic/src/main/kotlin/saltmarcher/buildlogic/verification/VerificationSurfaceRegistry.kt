package saltmarcher.buildlogic.verification

import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

open class VerificationSurfaceRegistry(
    val checkDocumentationEnforcement: TaskProvider<out Task>,
    val productionBuild: TaskProvider<out Task>,
    val qualityHygiene: TaskProvider<out Task>,
    val architecture: TaskProvider<out Task>,
    val viewTopology: TaskProvider<out Task>,
    val docs: TaskProvider<out Task>,
    val metricsReport: TaskProvider<out Task>,
    val desktopInstall: TaskProvider<out Task>,
    val productionHandoff: TaskProvider<out Task>
)
