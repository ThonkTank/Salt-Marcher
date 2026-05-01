import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

val domainUseCaseRulesetFile = layout.projectDirectory.file(
    "tools/quality/domain-usecase-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DomainApplicationNoSameContextPublishedDependency")
    }
}

val pmdDomainUseCaseEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Domain UseCase PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(domainUseCaseRulesetFile)
    source = files("bootstrap", "shell", "src").asFileTree
    include("**/*.java")
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.register("checkDomainUseCaseEnforcement") {
    group = "verification"
    description = "Run the dedicated Domain UseCase enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDomainUseCaseEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":domainUseCaseTopologyCheck"))
    dependsOn(gradle.includedBuild("build-harness").task(":domainUseCaseDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkDomainUseCaseEnforcement")
}

tasks.named("check") {
    dependsOn("checkDomainUseCaseEnforcement")
}
