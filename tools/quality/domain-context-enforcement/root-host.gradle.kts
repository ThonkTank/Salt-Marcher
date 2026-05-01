import org.gradle.kotlin.dsl.registering

val checkDomainContextEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Domain Context enforcement bundle through one root entrypoint."
    dependsOn(gradle.includedBuild("build-harness").task(":domainContextEnforcementDocumentationCheck"))
}
