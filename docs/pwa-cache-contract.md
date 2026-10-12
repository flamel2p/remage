# PWA cache and lifecycle contract

Implementation design for `release-web-pwa-v1`; runtime observations are recorded separately in [web-verification.md](web-verification.md). This document does not qualify physical or installed surfaces.

## Identity and inventory

A build has an embedded UI build ID and a generated version manifest with that ID, normalized absolute base path and asset-set digest. Inventory every final emitted shell, font, icon, module Worker, glue, WASM and notice file, including assets from nested Worker builds. Vite's entry manifest alone is insufficient. Exclude derived service-worker/version-manifest files from the digest cycle. SHA-256 and byte lengths identify required assets; a new compatible cache becomes complete only after all have been acquired and validated.

The UI accepts a version manifest only if its ID matches the embedded ID. A matching active controller and a complete cache status are both required for an offline-ready claim. Initial uncontrolled pages may finish setup without being offline-ready. An active registration, manifest response or completion marker alone is insufficient.

## Messages and recovery

Use versioned request/reply messages over a bounded MessageChannel. Requests carry an opaque request ID, action (`STATUS` or `RESTORE`), expected build ID and expected digest. Replies carry the same ID, actual worker identity, complete/partial/mismatch/error state, required/cached counts and allowlisted missing asset URLs. Invalid responses, timeouts, mismatches and partial caches cannot report readiness.

STATUS verifies the required cache entries, not only a marker. RESTORE repairs missing allowlisted assets with hash and length validation and a single in-flight operation. Recheck the entire set afterward. An unavailable network, quota failure, redirect/HTML asset fallback or hash mismatch leaves partial/error guidance and preserves previously validated entries. Explicit cache restore/update checks defer while the browser adapter reports busy; installer/service-worker scratch allocation also requires weakest-device memory qualification.

Recheck after controller changes, BFCache pageshow, visibility resume and before processing. A controlled page locks new intake/processing synchronously until a matching controller has been established; mismatch and timeout leave that lock in place while validated existing downloads remain usable. An uncontrolled first visit remains usable online and does not claim offline readiness. BFCache keeps retained session data through one synchronous adapter suspension method that stops scheduling and cancels transient work before the page is frozen; resume rechecks compatibility. Non-BFCache exit disposes session resources. Browser background scheduling remains outside dependable automatic processing guarantees.

Navigation serves the controlling worker's compatible shell only after required-set presence and its identity marker are complete. A cached HTML file alone is insufficient: selectively missing entry JavaScript would otherwise leave a blank workspace. An incomplete set triggers the same single in-flight, hash/length-validated missing-asset repair used by explicit RESTORE and installation. If its own compatible set cannot be recovered, show a small static recovery page and request registration.update from the active worker without depending on evicted page JavaScript. Never silently return a newer live HTML/version manifest from an old controller. This update request alone cannot claim that a new installation is complete. Recovery asks the user to close every Remage surface and reopen online/retry; complete shell eviction while offline can prevent launching the workspace. Immutable content-hashed assets may be recovered from older complete application caches; stable HTML/manifest URLs must not cross versions. Validate MIME for HTML, JavaScript, CSS and WASM before acquisition, including CSS under nosniff.

For a controlled page, inventory fetching uses the default request cache mode; an uncontrolled initial visit uses no-store. The embedded build/base/digest validation and controller STATUS remain mandatory in either case. Local Firefox testing observed no-store failing offline before cached inventory could be returned; this request-mode adjustment does not relax identity or completeness checks.

## Updates and clients

Do not use skipWaiting, clients.claim, automatic reload, automatic session clearing or old-cache deletion. A waiting build is visible. The user finishes and downloads required results or explicitly confirms session discard, closes every Remage browser/PWA window, then reopens. The browser's normal lifecycle is the activation barrier: a frozen, unresponsive or newly opened controlled client keeps the old worker active. A message acknowledgement or a client-count sample is not permission to force activation.

Keep prior complete caches and old immutable server assets for version 1; document storage growth/quota and independent eviction limits. A failed new installation removes only a newly created partial cache and cannot delete a previously complete rollback cache. A rollback publishes the complete earlier worker/manifest/asset set and follows the same waiting lifecycle.

This lifecycle follows the [Service Workers specification](https://www.w3.org/TR/service-workers/) and its [explainer](https://github.com/w3c/ServiceWorker/blob/main/explainer.md). All persistent caches contain application assets only; imported bytes, previews, identifying names, handles, results and download URLs stay outside them.
