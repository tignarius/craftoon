# Ink persistence and memory management

Implemented 2026-11-13.

## Ownership

- React `ComicPanel.drawingData` contains an immutable `craftoon-ink:<UUID>` reference. Legacy Base64 is accepted when opening older documents.
- `Application Support/CraftoonInk/<UUID>.drawing` holds lossless PencilKit archives. Library and recovery manifests reference these native files. Version 4 also stores reference photos as immutable files.
- `Application Support/CraftoonReferenceImages` stores PNG/JPEG photo files by content hash. React receives a short file URI and `imageRef`, not Base64 pixels. Loading an older document migrates its photos without re-encoding them and rebases file URIs to the current app container. Photo files are kept conservatively; ink revision cleanup does not delete reference photos.
- Treat the Library/Recovery manifests, the ink directory **and** the reference-image directory as one backup unit. Copying only a version 3 JSON file is insufficient. PDF export resolves the native archives before rendering.
- Opening a legacy document writes stable, content-derived ink files without overwriting its original manifest. A successful subsequent save adopts references.
- Only a live panel owns an editable `PKCanvasView`. Inactive panels render bounded previews (maximum edge 1200 pixels). On leaving the window for more than 100 ms, the live renderer and its native undo actions are released after checkpointing the ink. Transient Fabric z-order reparenting preserves the existing pixels. A preview remains above a newly activated renderer until PencilKit finishes rendering, then the overlay is hidden on the next main turn. Retired render callbacks cannot hide an inactive panel preview.

## Save scheduling

Main-thread capture copies PencilKit values and assigns references; it does not archive the strokes. A shared serial queue writes each changed ink revision atomically once, then writes its manifest. Unchanged ink is not archived again.

Recovery permits one write in flight and one pending latest state. A burst of updates does not retain one full document per request. Callbacks complete only after their checkpoint succeeds or fails. A missing ink file prevents replacing the last good manifest.

Archive serialization has its own worker-only lock. Main-thread reference bookkeeping never waits for a drawing archive or photo compression. Preview rendering also runs independently of the persistence queue; its source drawing stays cached until the checkpoint finishes. Repeated identical canvas geometry/background updates do not invalidate its renderer.

Background checkpoints use an iOS background task. The termination fallback waits for the serial writer. Neither mechanism guarantees survival of every stroke if iOS kills the process before a checkpoint; last valid files remain atomic.

## Retention

- React Undo: up to 100 states, with a 24 MiB budget for unique drawing/photo payload strings. Current state and one Undo are preserved even when a single document exceeds the budget.
- Native Undo: 20 groups, reduced to 5 on a memory warning. React also releases older history on a memory warning.
- Only current document IDs remain in the native latest-reference table. Live drawing values are released when their renderer leaves the window or becomes an inactive preview.
- Ink cleanup runs at most once per minute during reference updates. It preserves Library, recovery, Trash, current document and Undo/Redo references. Two-minute file/read leases protect in-flight handoffs. Unreadable manifests disable deletion. Obsolete immutable revisions can then be removed without affecting retained edits.

## Interaction

Panel modes are Layout and Draw. Draw's system PencilKit palette provides the pen, eraser and lasso. There is no separate Edit panel mode and no custom layer per stroke. Selecting references temporarily pauses drawing while keeping the Draw mode.

## Verification

Native regressions cover 3,000-stroke archive round trips, immutable revisions, stable legacy migration, 100 coalesced recovery requests, failed-write recovery preservation, inactive/unmounted renderer release, restoration before a React prop changes, panel resize checkpoints, and garbage-collection roots/leases. JavaScript regressions cover history budgets, reference retention and the two-mode UI; existing image import tests remain in place.

Pre-update device backups are at `/private/tmp/craftoon-before-performance-20261113` and `/private/tmp/craftoon-before-image-performance-20261113` on the development Mac. Copy the complete backup before attempting a rollback to an older app that cannot read native references.

## Limits

The active drawing still contains its editable vectors, so arbitrarily large drawings can exceed PencilKit or device limits. Photo transforms and other small document metadata remain in the manifest; photo pixels are stored separately. No destructive flattening or automatic loss of stroke editability is introduced. The reported spontaneous exits have not been tied conclusively to a Craftoon crash/jetsam report; long-running testing on the physical iPad remains necessary.

## Multi-photo regression verification

An eight-panel fixture with eight different noisy PNGs produced an 8,538,779-byte legacy JSON bridge payload. File-backed photos reduced that payload to 4,067 bytes while preserving the original photo bytes and transform settings. A blocked archive-writer regression verifies that main-thread capture completes without waiting for serialization. These are workload/payload checks, not a claim of a measured frame rate on every iPad.
