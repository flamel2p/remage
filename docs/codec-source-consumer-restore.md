# Private codec-source consumer restoration

This records the additional `release-web-pwa-v1` task 10.5 preparation check on **2026-10-13**. A new private workspace restored the frozen packet and ran the archived corrected adapter with newly installed dependencies against both retained WASM modules. It does not authorize distribution or close task 10.5.

## Frozen inputs

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| Private source packet | 116,207,363 | `748408595254f031c665bd2c9e6457490478d619b117490e74ebbad325b20e15` |
| Adjacent member manifest | 34,554 | `1a5ab3dbe822b5116a6caed615b65fbb4767b1ab83b25ae5aba1f46de027bd03` |
| Restored corrected application tar | 2,519,040 | `90c8a93f2fc89d1037a3fa1f9e1dd57e09b29f44ed43059abfbad6fc3109abdb` |
| Retained baseline WASM | 15,446,944 | `f8c67c10f37a26148984dd0002d27d21e6a79e118f6c36ec1cd24292f5f049aa` |
| Retained modified-libheif WASM | 15,446,974 | `e26dc4852cc89ff5d27e0db739f3b790c60b09ed1252044d0de9d0b627eb389c` |

The packet preserves the original parent commit `8f2c5b48a4e8a388591ce309ec5a350531d34178` and the two-file correction separately. Current Git HEAD was not used to export or regenerate any input. The historical source/build/relink provenance remains in [codec-source-evidence.md](codec-source-evidence.md).

## Isolation and restoration

The owned workspace was `/private/tmp/remage-codec-consumer-i4pcmb6p`, mode **0700**, outside the main repository. Before extraction, the helper checked the pinned packet/manifest hashes and byte lengths, then verified all **178** envelope members against the manifest. Both outer and current-layer tar extraction used explicit Python `filter='data'`. The restore copied **127** application files, all **13** packet tools and **28** sealed raw source archives. The copied `prepare.py` passed with **28 verified sources / 81 licence texts** in **4.365 seconds**. No source build was repeated.

No Git ancestor, `.env` file, private agent configuration, existing project dependency tree or external dependency symlink was present. Each child process received an explicit environment allowlist. `HOME` was not reassigned. Empty owned `XDG_CONFIG_HOME/pnpm/config.yaml`, `XDG_CONFIG_HOME/pnpm/rc` and user npmrc replaced user/global package-manager configuration; selected `pnpm config get` checks confirmed those paths and `https://registry.npmjs.org/`. The archived project settings and `allowBuilds` policy remained unchanged. pnpm documents its [configuration locations/environment prefix](https://pnpm.io/configuring) and [offline/frozen installation semantics](https://pnpm.io/cli/install).

The fresh install command, from the restored application root and with that isolated environment, was as below. `$REMAGE_CONSUMER_STORE` denotes the existing local content-addressed store root; the exact host path is retained in the ignored receipt.

```sh
pnpm install --offline --frozen-lockfile \
  --store-dir "$REMAGE_CONSUMER_STORE" \
  --registry https://registry.npmjs.org/ --reporter append-only
```

It completed **exit 0 in 4.009 seconds**; pnpm's own summary reported 3.9 seconds. It reused **487 packages**, reported **zero downloads**, checked **605 lockfile policy entries**, and ran the declared esbuild postinstalls. Official-registry fallback was unnecessary. This used the existing content-addressed package store; it was neither an empty-cache test nor an OS-level network-disconnection test. The recorded package versions are Node **24.14.1**, pnpm **11.18.0**, Python **3.14.8**, Vite **7.3.6**, Sharp **0.35.4**, Magick WASM **0.0.44**, and Zod **4.5.4**.

## Actual consumer proofs

The commands below were executed from the restored app. `$REMAGE_CONSUMER_APP` denotes its absolute `remage-work` path, and `$REMAGE_CONSUMER_BUNDLE` its sibling extracted `remage-codec-source` directory. These names describe the retained command arguments, not additional configuration imported by the smoke.

```sh
python3.14 tools/codec-source/prepare.py --work release/codec-source/work
node tools/codec-source/prove-adapter.mjs \
  "$REMAGE_CONSUMER_BUNDLE/artifacts/baseline/magick.wasm" \
  "$REMAGE_CONSUMER_APP/release/codec-source/consumer-proof/baseline" \
  "$REMAGE_CONSUMER_APP"
node tools/codec-source/prove-adapter.mjs \
  "$REMAGE_CONSUMER_BUNDLE/artifacts/modified-libheif/magick.wasm" \
  "$REMAGE_CONSUMER_APP/release/codec-source/consumer-proof/modified" \
  "$REMAGE_CONSUMER_APP" -remage-relink-proof
```

The script was the **copied packet tool**, and both compiled proof directories were below the restored app. This matters: module imports resolve relative to the script/generated output, while the tool records the wrapper from its working directory. Invoking the main repository's tool with only a changed working directory could otherwise mix dependency provenance.

All **18 PNG/JPEG/WebP input/output cases** passed the actual adapter and independent Sharp output checks. Each source hash, supplied-module identity, measured wrapper identity and nine-case record matched the corresponding frozen current-layer proof. Baseline and modified results had identical hashes for all nine output pairs. The modified module exposed **`1.23.5-remage-relink-proof`** in AVCI/AVIF/HEIC/HEIF registry metadata; this remains a compiled header/registry observation, not a direct `heif_get_version()` call.

Fresh Vite/Sharp/Magick/Zod package roots and entry realpaths stayed below the restored app, including pnpm's local virtual store. The installed published wrapper ESM bundle retained SHA-256 `cf1db24f7e63f560118ef434fd581dc9ef66ad099dc417184765cd6076fb4a1b`, declaring Native **2026.927.1314**. Generated baseline/relink glue was retained in the packet, not substituted in these tests.

Using fresh Vite, the helper compiled the **restored** `scripts/pwa-build.ts` with an explicit empty environment directory and recomputed root/default-tag build ID **`d01caddb56c9d3b94daa999f424dfee7dd36b3169d1a583bb572dcc33ace91bc`**. All 127 restored application files, all 13 copied tools and the lockfile remained byte-identical. The original packet and main canonical build ID/digest/SW hash were unchanged. No production web build or canonical replacement occurred.

## Receipt and remaining gates

The ignored `release/codec-source/consumer-restore/` directory retains the orchestration/identity helpers, exact command arguments, environment-key allowlist, timings, resolved package paths, logs and JSON proofs:

- `evidence.json`: SHA-256 `5455f3881cd1639842127ed648963cb497bc1cf3fd60df4fdd827c5c313f2a8b`.
- `baseline-evidence.json`: SHA-256 `341c5a03954bbe50662c49753f37c3c609df2ce0beb9e6fc537e671865016b7d`.
- `modified-evidence.json`: SHA-256 `79ac701eed1de351b82a0bee0575511ca1328707e39bdfa58facde22238bb64a`.

All restore/install/proof/verification processes exited successfully. The detached workspace is retained until independent review and the lead's exact configured-key scan finish; any later removal is recorded separately without rewriting the frozen proof receipt. For reconstruction instructions, use the private-packet section of [codec-source-rebuild.md](codec-source-rebuild.md), select its current-layer tar, and keep script/output paths inside the restored app.

This proves private consumer restoration and the tested Node replacement path. It does not establish published-binary attestation, another source rebuild, arbitrary ABI compatibility, generated-glue runtime compatibility, browser/offline/installed/device qualification or peak memory. Dependencies-script redistribution rights, artifact-specific legal review and matching public publication remain open under [browser-codec-source-release.md](browser-codec-source-release.md). Nothing was uploaded or published.
