package saltmarcher.buildlogic.verification

internal fun org.gradle.api.Project.registerQualityConventionHarness(
    environment: QualityConventionEnvironment,
    @Suppress("UNUSED_PARAMETER") toolConfigurations: QualityConventionToolConfigurations
): VerificationHarnessExtension {
    val verificationLayout = environment.verificationLayout
    val harness = VerificationHarnessExtension(
        project = this,
        sourceSets = verificationLayout.sourceSets,
        mainSourceSet = verificationLayout.mainSourceSet,
        includeQualityRulesErrorProne = environment.includeQualityRulesErrorProne
    )
    extensions.add(VerificationHarnessExtension::class.java, "saltmarcherVerificationHarness", harness)
    return harness
}
