# Contracts: Chat E2EE Recovery File Enforcement

> No new HTTP endpoints, DTOs, or push events are introduced by this
> feature. The enforcement is entirely client-side on top of the
> standard Matrix client-server API used by the existing E2EE bootstrap.

## Endpoints

None added or changed. The feature relies on the existing Matrix SSSS,
cross-signing, and key-backup endpoints already used by the
`EncryptionSetupCubit`.

## Events (WebSocket / Push)

None.

## Local Persistence Contract

> Documentation-only shape. Describes the local key/value contract
> introduced by this feature.

```dart
// documentation-only
//
// SharedPreferences key schema for the per-user "recovery file
// downloaded" flag. The Matrix user ID is the full MXID
// (e.g. "@alice:matrix.example.org").
//
// Key:   'e2ee_recovery_downloaded:<matrixUserId>'
// Value: bool (true once the user has both downloaded the recovery
//        file AND confirmed storage on this device)
//
// Lifecycle:
// - Written exactly once per (device, user) when the user taps
//   "Fertig" in the saveRecoveryFile phase.
// - Read on every EncryptionSetupCubit init to decide whether to
//   show saveRecoveryFile or skip straight to done.
// - Removed on logout / user-switch as part of the device-local
//   cache wipe.
```

## Tracker Interface

> Documentation-only shape. The actual interface lives in
> `packages/matrix_chat` and is implemented in `apps/tagea_frontend`
> using `shared_preferences`.

```dart
// documentation-only
abstract class RecoveryFileDownloadTracker {
  Future<bool> isDownloaded(String matrixUserId);
  Future<void> markDownloaded(String matrixUserId);
}
```

## Data Models

No new wire models. `RecoveryFileData` (already defined in
`packages/matrix_chat`) continues to be passed to the
`onDownloadRecoveryFile` callback unchanged.
