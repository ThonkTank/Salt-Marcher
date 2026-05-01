import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DomainFactoryRoleShape",
            "DomainFactoryStatelessness"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val checkDomainFactoryEnforcement by tasks.registering {
    group = "verification"
    description = "Run the focused Domain Factory enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(gradle.includedBuild("build-harness").task(":domainFactoryEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDomainFactoryEnforcement)
}

tasks.named("check") {
    dependsOn(checkDomainFactoryEnforcement)
}
