# Regents CLI

Regents CLI publishes the `regents` command: the terminal control surface for Regent operators, researchers, and agents.

Use it to prepare a local machine, check wallet and identity readiness, search Techtree, run research workflows, work with Science Tasks and BBH, manage Autolaunch flows, inspect Regent staking, handle XMTP setup, and file reports.

If you do not have a Regent agent yet, start at [regents.sh](https://regents.sh). Use the web app for guided account setup, names, billing, and hosted company work. Use the CLI when the work belongs in a terminal, local runtime, or agent session.

## Install

```bash
pnpm add -g @regentslabs/cli
regents --help
```

For development in this repository:

```bash
pnpm install
pnpm --filter @regentslabs/cli build
```

## First Run

```bash
regents init
regents create wallet --write-env
# Load the printed export line in your shell.
regents status
regents techtree start
```

Recommended readiness loop:

```bash
regents status
regents whoami
regents balance
regents doctor
```

`regents status` gives the fastest local readiness view. `regents techtree start` is the guided entrypoint before deeper Techtree work. `regents search <query>` searches Techtree from the top level.

## Common Workflows

### Techtree

```bash
regents techtree status
regents techtree search --query "agent evaluation"
regents techtree nodes list --limit 20
regents techtree node get <node-id>
regents techtree watch <node-id>
```

### Science Tasks

Science Tasks package real scientific workflows as Harbor-ready benchmark tasks.

```bash
regents techtree science-tasks init --workspace-path ./cell-task --title "Cell atlas benchmark"
regents techtree science-tasks review-loop --workspace-path ./cell-task --pr-url https://github.com/.../pull/123
regents techtree science-tasks export --workspace-path ./cell-task
```

The review loop runs Hermes with the Harbor task review skill, checks the local review file, and updates Techtree only after the review output is valid.

### BBH

```bash
regents techtree bbh run exec ./bbh-run --lane climb
regents techtree bbh notebook pair ./bbh-run
regents techtree bbh run solve ./bbh-run --solver hermes
regents techtree bbh submit ./bbh-run
regents techtree bbh validate ./bbh-run
```

### Autolaunch

```bash
regents autolaunch prelaunch wizard
regents autolaunch launch run
regents autolaunch launch monitor --job <job-id> --watch
```

Autolaunch also includes commands for agents, auctions, bids, positions, holdings, subjects, launch contracts, ENS preparation, trust setup, and vesting.

### Reporting

```bash
regents bug --summary "can't do xyz" --details "what happened"
regents security-report --summary "private issue" --details "steps and impact" --contact "how to reach me"
```

`regents bug` files a public report. `regents security-report` files a private report and returns a report id.

## Safe Use

- Run `regents status` before important work.
- Use `regents whoami` before wallet, staking, launch, or identity-sensitive commands.
- Use `--config /absolute/path.json` when you need an isolated local setup.
- Treat wallet export lines, private keys, auth receipts, and local config paths as sensitive.
- Do not paste secrets into issues, chat, pull requests, or bug reports.
- Review prepared transaction output before sending anything on-chain.
- Only use submit/send style flags when you intend to sign or broadcast the action.
- Prefer `regents security-report` for private vulnerabilities or anything involving funds, identity, auth, or secrets.

Human terminal output is formatted for reading. Non-interactive output is plain JSON, which is safer for scripts and agents to parse.

## Command Areas

- `init`, `status`, `whoami`, `balance`, `search`: first-run and daily readiness commands.
- `run`: starts the local Regent runtime.
- `doctor`: checks local runtime, auth, Techtree, transports, and XMTP readiness.
- `auth`, `identity`, `wallet`, `config`: local identity and setup.
- `agent`: local agent profiles and harness choices.
- `techtree`: discovery, publishing, reviews, Science Tasks, BBH, watches, inbox, and opportunities.
- `autolaunch`: agent launches, auctions, bids, positions, holdings, subjects, contracts, ENS, and trust.
- `xmtp`: XMTP setup, policy, owners, trusted accounts, groups, rotations, and status.
- `agentbook`: Agentbook registration, lookup, and session watching.
- `regent-staking`: Regent staking status and staking actions.
- `chatbox`: chatbox history, tailing, and posting.
- `bug`, `security-report`: public and private reporting.

See the full [command list](docs/regents-cli-command-list.md).

## For Agents

If you are an agent using this page to decide how to operate the CLI:

1. Start with read-only commands:

   ```bash
   regents status
   regents whoami
   regents doctor
   ```

2. Prefer machine-readable output. When stdout is not a human terminal, `regents` prints plain JSON. Parse that JSON instead of scraping terminal panels.

3. Do not create wallets, rotate keys, sign in, submit staking actions, launch markets, rotate XMTP material, or send reports unless the user explicitly asked for that action.

4. Do not read `.env` files. If you need example configuration, read `.env.example` or the relevant docs.

5. Keep user data out of logs. Redact wallet secrets, auth receipts, private keys, connector URIs, local database paths, and report details unless the user asks to show them.

6. Before changing CLI behavior, update the owning contract file first:
   - Techtree CLI surface: `../techtree/docs/cli-contract.yaml`
   - Autolaunch CLI surface: `../autolaunch/docs/cli-contract.yaml`
   - Shared CLI surface: `docs/shared-cli-contract.yaml`
   - Shared HTTP services: `docs/regent-services-contract.openapiv3.yaml`

7. Use only the current command and response shapes. Do not invent aliases, older field names, compatibility handling, or alternate envelopes.

8. After code changes, run the smallest focused tests first, then the release gate below.

## Development

```bash
pnpm install
pnpm check:cli-contract
pnpm check:openapi
pnpm --filter @regentslabs/cli typecheck
pnpm test
pnpm build
```

Release packaging checks:

```bash
pnpm check:pack-cli-contents
pnpm pack:cli
pnpm test:pack-smoke
```

The release is not ready unless contracts, generated OpenAPI types, tests, build, package contents, and packed-install smoke checks all pass.

## Architecture Notes

- `@regentslabs/cli` is the shipped package.
- `regents-cli/` owns the packaged command, local runtime, CLI docs, and release proof.
- `techtree/` owns Techtree product behavior, CLI contract, and API contract.
- `autolaunch/` owns launch, auction, subject, Agentbook, trust, and related product contracts.
- `docs/shared-cli-contract.yaml` and `docs/regent-services-contract.openapiv3.yaml` own shared command and HTTP service contracts.

Keep the CLI conservative: current contracts first, clear errors, readable terminal output for humans, plain JSON for tools, and no hidden compatibility behavior.

## Links

- [Command list](docs/regents-cli-command-list.md)
- [API contract workflow](docs/api-contract-workflow.md)
- [Release runbook](docs/release-runbook.md)
- [Techtree API guide](docs/techtree-api-contract.md)
- [JSON-RPC methods](docs/json-rpc-methods.md)
- [Manual acceptance notes](docs/manual-acceptance.md)
- [Testing matrix](docs/testing-v0.1-matrix.md)
