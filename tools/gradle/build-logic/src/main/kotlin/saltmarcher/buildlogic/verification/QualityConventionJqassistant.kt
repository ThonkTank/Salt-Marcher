package saltmarcher.buildlogic.verification

import org.gradle.api.tasks.Sync
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin

internal fun org.gradle.api.Project.registerQualityConventionHarness(
    environment: QualityConventionEnvironment,
    toolConfigurations: QualityConventionToolConfigurations
): VerificationHarnessExtension {
    val verificationLayout = environment.verificationLayout
    val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
    val installJqassistant = tasks.register<Sync>("installJqassistant") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Install the jQAssistant command-line distribution into the build directory."
        from({
            toolConfigurations.jqassistantDistribution.get().resolve().map { zipTree(it) }
        })
        into(jqassistantInstallDir)
    }
    val jqassistantCliFile = jqassistantInstallDir.map { installDir ->
        installDir.file("jqassistant-commandline-neo4jv5-${environment.jqassistantVersion}/bin/jqassistant")
    }
    val jqassistantJvmOpens = listOf(
        "--add-opens", "java.base/java.lang=ALL-UNNAMED",
        "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
        "--add-opens", "java.base/java.io=ALL-UNNAMED",
        "--add-opens", "java.base/java.nio=ALL-UNNAMED"
    ).joinToString(" ")
    val harness = VerificationHarnessExtension(
        project = this,
        sourceSets = verificationLayout.sourceSets,
        mainSourceSet = verificationLayout.mainSourceSet,
        sourceJavaRoots = verificationLayout.sourceJavaRoots,
        commonFocusedArchunitSupportIncludes = verificationLayout.commonFocusedArchunitSupportIncludes,
        jqassistantTaskRegistrar = JqassistantTaskRegistrar(
            project = this,
            cliFile = jqassistantCliFile,
            jvmOpens = jqassistantJvmOpens,
            installJqassistant = installJqassistant
        )
    )
    extensions.add(VerificationHarnessExtension::class.java, "saltmarcherVerificationHarness", harness)
    return harness
}
