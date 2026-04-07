# Sync Directory

## Purpose

`sync/` holds short-lived transfer files used for device-to-device sync.

## Where New Code Goes

- Put short-lived sync payloads here only when they exist solely to move data between devices.

## Forbidden Drift

- Do not put application logic, durable project assets, or architectural documentation here.
- Remove transfer files once the sync is complete.
