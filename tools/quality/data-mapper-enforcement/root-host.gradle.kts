import org.gradle.api.plugins.quality.Pmd
import org.gradle.kotlin.dsl.registering

val dataMapperRulesetFile = layout.projectDirectory.file(
    "tools/quality/data-mapper-enforcement/pmd/ruleset.xml"
)

val pmdDataMapperEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Data Mapper PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(dataMapperRulesetFile)
    source = fileTree("src") {
        include("data/**/mapper/**/*.java")
    }
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val checkDataMapperEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Data Mapper enforcement bundle through one root entrypoint."
    dependsOn(pmdDataMapperEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":dataMapperEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDataMapperEnforcement)
}

tasks.named("check") {
    dependsOn(checkDataMapperEnforcement)
}
