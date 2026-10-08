# REUI tooling, adoption and credential maintenance

Maintained 2026-10-08. [design.md](../design.md) owns visual decisions. This guide distinguishes connected development tooling from future renderer/component implementation.

## Current readiness

| Layer | Evidence / status |
| --- | --- |
| Project registration | [.codex/config.toml](../.codex/config.toml) declares Streamable HTTP REUI, timeouts and the non-secret `X-Reui-Style: radix-nova` header |
| Endpoint | `https://mcp.reui.io/api/mcp`, the documented explicit form of `https://mcp.reui.io`; matches the existing global registration without changing it |
| Authentication | `codex mcp login reui` completed successfully through browser OAuth on 2026-10-08; no bearer or Authorization secret is committed |
| In-session discovery | REUI tools became callable in this session; `get_project_context`, `get_agent_skill`, catalog search and icon metadata discovery succeeded |
| Account entitlement | Live context reported Ultimate; this establishes catalog access, not public redistribution rights |
| Style routing | `radix-nova` header is configured; initial live discovery preceded this header and used default Base docs. Reload/reconnect and confirm `get_project_context.projectStyle.current` before component adoption |
| Local agent skill | Live `get_agent_skill` workflow version `e7aac3424a` was read; no vendor installer was run and no competing local rule source was created |
| UI framework/source | Existing React 19 renderer still uses custom CSS. Tailwind v4/shadcn initialization, REUI source adoption and token/font migration are pending in the web execution change |
| Motion Icons | Ekko chose outline Motion Icons after written public-source redistribution permission. Permission has not been supplied; no premium source/assets were installed |
| Credentials | Ignored root `.env.local` exists with blank optional entries. No license key or personal token was supplied, printed or embedded |

The CLI's `Auth: Unknown` display is not a connection verdict. The OAuth success and actual read-only MCP responses are the authentication/connectivity evidence. None establishes product UI, accessibility, processing or offline qualification.

## Where to maintain credentials

Maintain an optional **registry license key in the project root `.env.local`**, under `REUI_LICENSE_KEY`. Keep a password-manager copy as the durable source; the local file is for development use. The file has mode 0600 and is ignored by Git; [.env.local.example](../.env.local.example) is the safe, blank template.

```dotenv
REUI_LICENSE_KEY=
REUI_MCP_TOKEN=
```

- Fill `REUI_LICENSE_KEY` from the REUI account when licensed registry installs are needed. Free components/examples do not need it. A key does not satisfy the public-source rights gate.
- `REUI_MCP_TOKEN` is optional for headless MCP authentication using a personal token. Interactive development currently uses OAuth, so no MCP token is needed in this file.
- Credentials never belong in `design.md`, `components.json` as literal values, committed TOML, screenshots/logs, frontend-prefixed variables, PWA caches or packaged applications. In this Vite project, never use a `VITE_` prefix for either credential.
- REUI MCP is development tooling. Image selection/processing/export uses no REUI account, credential, registry or remote image request at runtime.

Codex does not automatically load a project's `.env.local` as its process environment. For deliberate token mode, load a trusted local file in the terminal that launches Codex:

```sh
set -a
source .env.local
set +a
codex
```

Then replace the OAuth-only REUI table's authentication with an environment reference:

```toml
[mcp_servers.reui]
url = "https://mcp.reui.io/api/mcp"
http_headers = { "X-Reui-Style" = "radix-nova" }
bearer_token_env_var = "REUI_MCP_TOKEN"
```

Choose OAuth or token mode deliberately. An explicit bearer takes precedence over stored OAuth; an invalid token can override an otherwise working login. `${REUI_LICENSE_KEY}` in Codex static `http_headers` is literal text, not expansion. For GUI launches, environment inheritance needs separate verification; OAuth avoids that dependency.

OAuth credentials remain in Codex's managed credential store. Review/revoke REUI connections or generate a personal token in [Account → MCP](https://reui.io/account/mcp). Rotate leaked keys/tokens through the account and local/CI secret stores; avoid printing their values during checks. For future CI access, use the CI secret store, not a committed env file.

## Open-source rights gate

REUI free primitives/hooks/components and free `c-*` examples are MIT. Premium blocks, Motion Icons and templates use separate proprietary terms; even a template marked Free is not automatically MIT. Ordinary Ultimate access does not permit publishing that source in Remage's public repository. [Official REUI license](https://reui.io/legal/license)

Before Motion Icon adoption, record an explicit written grant covering Remage's public source distribution and intended fork/contribution/rebuild use. Record the agreement's scope, applicable notices and any license exceptions in the release evidence; keep private agreement/account details outside public source. Obtain clarification if the grant permits public viewing but restricts downstream open-source reuse. Until resolved, retain the existing local icons and keep premium intake pending.

Permission for icons does not automatically cover blocks or templates. The MIT application license does not relicense vendor assets. The font OFL notices are already bundled separately.

## Future component adoption sequence

1. Reconnect REUI and confirm `radix-nova` in live context. Use Card surfaces consistently and pass `surface: 'card'` to searches/composition.
2. Introduce reviewed/pinned Tailwind v4 and shadcn tooling in an isolated shared-UI slice, with explicit aliases/build boundaries. Review reset/CSP/native renderer effects. Keep the native engine unchanged.
3. Import the local font declarations and REUI token mapping into the shared styling entry. Remove superseded literals/default token overrides gradually; check both themes before broad adoption.
4. Initialize the complete `components.json` through the reviewed setup. Its registry portion for free source is:

   ```json
   {
     "style": "radix-nova",
     "registries": {
       "@reui": "https://reui.io/r/{style}/{name}.json"
     }
   }
   ```

   This is a partial reference, not an initialized project config. For permitted premium installs, use the registry object/header form from [license setup](https://reui.io/docs/license-setup), with `Bearer ${REUI_LICENSE_KEY}` expanded by shadcn. Registry substitution rules differ from Codex MCP rules.

5. Search a specific pattern, read its API and examples, inspect licenses/dependencies/registry source, then use the returned command with reviewed tooling. REUI is a shadcn registry namespace; `@reui/...` is not an npm dependency scope to install directly.
6. Keep local validation, original-source identity, real queue/progress and export receipts. Remove placeholder URLs/uploads/demo state. Record dependency versions and source provenance; run API validation/audit and the relevant product checks.
7. Adopt outline Motion Icons as a separate slice after rights and registry credentials are ready. Resolve registry names through MCP, review static/animated exports, test reduced motion and retain the applicable license text.

Copy-and-own components avoid an online runtime dependency, but upstream compatibility/security fixes remain maintenance work. Review Base-versus-Radix dependencies rather than assuming a style name proves every nested primitive is Radix. Use a smaller composition when a registry result is a weak semantic match; do not install a Data Grid solely because a file-picker search returned it.

## Connection checks

```sh
codex mcp get reui
codex mcp login reui
```

Then call live `get_project_context`, `get_agent_skill` and one specific free catalog lookup. Verify API/style/plan fields, rather than relying only on registration. Do not install a component to test connectivity. Keep prompts generic; do not send user images, private source names or native paths to the registry.

On 2026-10-08, the initial broad local-picker search returned a weak Data Grid match; it was not adopted. The targeted File Upload lookup is a tooling/API check, not an upload feature or production integration. Icon metadata discovery succeeded, but no premium source was fetched or imported.

## Official references

- [REUI MCP](https://reui.io/docs/mcp), [Codex connection](https://reui.io/docs/codex), [license-key setup](https://reui.io/docs/license-setup), [registry](https://reui.io/docs/registry), [styling](https://reui.io/docs/styling), and [framework prerequisites](https://reui.io/docs/get-started).
- [Official OpenAI MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli): trusted project config, OAuth login and environment-backed token references. Local `codex mcp --help`, `add --help` and `login --help` were also inspected.
- [UI/UX authority](../design.md), [font provenance](../assets/fonts/google/manifest.json), [web tasks](../openspec/changes/release-web-pwa-v1/tasks.md).
