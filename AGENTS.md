# Remage agent team

This project uses a six-role, on-demand agent roster. Role files guide routing;
they do not start persistent agents or enforce a dependency graph. The lead
orchestrator explicitly delegates a bounded task and synthesizes its evidence.

## Operating rules

- Read the active OpenSpec change and affected source before proposing or editing work.
- Use OpenSpec for non-trivial features, cross-cutting changes, and changes that alter user-facing behaviour: explore, propose, apply, then verify and archive.
- Keep one implementation owner at a time for overlapping files or contracts.
- Requirements, design decisions, architecture decisions, test evidence, and documentation must name their source and distinguish plans from implemented behaviour.
- Do not claim UI, test, build, or review completion without the relevant evidence.

## Routing

1. `product-manager` defines the problem, scope, requirements, acceptance criteria, and delivery plan.
2. `technical-lead` designs the architecture and identifies contracts, risks, and documentation updates.
3. `uiux-designer` defines the design language and validates user flows before and after implementation.
4. `lead-orchestrator` reconciles these inputs and assigns one `developer` implementation slice.
5. `qa` derives and runs tests from the approved acceptance criteria.
6. `technical-lead` reviews the delivered code and documentation; `lead-orchestrator` reports the final evidence and unresolved risks.

Use parallel review only for independent, read-only work. The developer is the only role that changes product code unless the lead explicitly assigns a different implementation owner.

## Agent files

- `.codex/agents/lead-orchestrator.toml`
- `.codex/agents/uiux-designer.toml`
- `.codex/agents/product-manager.toml`
- `.codex/agents/developer.toml`
- `.codex/agents/technical-lead.toml`
- `.codex/agents/qa.toml`
