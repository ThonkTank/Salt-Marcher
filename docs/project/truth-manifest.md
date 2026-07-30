# Product truth manifest

This manifest identifies where each kind of claim belongs.

- **Product behavior:** [vision](vision.md), feature requirements, confirmed
  acceptance cases, static catalogs, reference tables, and Golden-Master
  fixtures.
- **Technical direction:** [target architecture](architecture/target-architecture.md),
  the [development persistence contract](contract/persistence-lifecycle.md),
  and the current Campaign registry contract. Feature persistence contracts for
  later milestones are not active implementation direction until their vertical
  slice explicitly renews them.
- **Work status:** active GitHub issues and pull requests. Do not record
  mutable CI run identifiers or live completion claims in architecture docs.
- **Measurement evidence:** versioned artifacts in
  [`docs/project/evidence/`](evidence/).

The `javafx-final-2026-07-27` Git tag preserves the retired implementation.
Java, JavaFX, JDBC, and Gradle are not active product architecture.
