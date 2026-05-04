# Regents CLI Command List

This file lists the full command surface shipped by the standalone Regents CLI in this repo.

Source used: CLI contract YAML files via `scripts/generate-cli-command-metadata.mjs`.

Total commands: 300.

## Full Command List

### Agent

- `regents agent connect hermes`
- `regents agent connect openclaw`
- `regents agent execution-pool`
- `regents agent harness list`
- `regents agent init`
- `regents agent link`
- `regents agent profile list`
- `regents agent profile show`
- `regents agent status`

### Agentbook

- `regents agentbook lookup`
- `regents agentbook register`
- `regents agentbook sessions watch`

### Auth

- `regents auth login`
- `regents auth logout`
- `regents auth status`

### Autolaunch

- `regents autolaunch agent <id>`
- `regents autolaunch agent readiness <id>`
- `regents autolaunch agents list`
- `regents autolaunch auction <id>`
- `regents autolaunch auction-returns list`
- `regents autolaunch auctions list`
- `regents autolaunch bids claim`
- `regents autolaunch bids exit`
- `regents autolaunch bids place`
- `regents autolaunch bids quote`
- `regents autolaunch contracts admin`
- `regents autolaunch contracts job`
- `regents autolaunch contracts subject`
- `regents autolaunch ens plan`
- `regents autolaunch ens prepare-bidirectional`
- `regents autolaunch ens prepare-ensip25`
- `regents autolaunch ens prepare-erc8004`
- `regents autolaunch factory revenue-ingress set-authorized-creator`
- `regents autolaunch factory revenue-share set-authorized-creator`
- `regents autolaunch fee-registry show`
- `regents autolaunch fee-vault show`
- `regents autolaunch fee-vault withdraw-regent`
- `regents autolaunch holdings claim-and-stake-emissions`
- `regents autolaunch holdings claim-emissions`
- `regents autolaunch holdings claim-usdc`
- `regents autolaunch holdings stake`
- `regents autolaunch holdings sweep-ingress`
- `regents autolaunch holdings unstake`
- `regents autolaunch identities list`
- `regents autolaunch identities mint`
- `regents autolaunch ingress create`
- `regents autolaunch ingress rescue`
- `regents autolaunch ingress set-default`
- `regents autolaunch ingress set-label`
- `regents autolaunch jobs watch`
- `regents autolaunch launch create`
- `regents autolaunch launch finalize`
- `regents autolaunch launch monitor`
- `regents autolaunch launch preview`
- `regents autolaunch launch run`
- `regents autolaunch prelaunch publish`
- `regents autolaunch prelaunch show`
- `regents autolaunch prelaunch validate`
- `regents autolaunch prelaunch wizard`
- `regents autolaunch registry link-identity`
- `regents autolaunch registry rotate-safe`
- `regents autolaunch registry set-subject-manager`
- `regents autolaunch registry show`
- `regents autolaunch safe create`
- `regents autolaunch safe wizard`
- `regents autolaunch splitter accept-ownership`
- `regents autolaunch splitter activate-eligible-revenue-share`
- `regents autolaunch splitter cancel-eligible-revenue-share`
- `regents autolaunch splitter cancel-treasury-recipient-rotation`
- `regents autolaunch splitter execute-treasury-recipient-rotation`
- `regents autolaunch splitter propose-eligible-revenue-share`
- `regents autolaunch splitter propose-treasury-recipient-rotation`
- `regents autolaunch splitter pull-treasury-share`
- `regents autolaunch splitter reassign-dust`
- `regents autolaunch splitter set-label`
- `regents autolaunch splitter set-paused`
- `regents autolaunch splitter set-protocol-recipient`
- `regents autolaunch splitter show`
- `regents autolaunch splitter sweep-protocol-reserve`
- `regents autolaunch splitter sweep-treasury-reserved`
- `regents autolaunch splitter sweep-treasury-residual`
- `regents autolaunch strategy migrate`
- `regents autolaunch strategy sweep-currency`
- `regents autolaunch strategy sweep-token`
- `regents autolaunch subjects claim-and-stake-emissions`
- `regents autolaunch subjects claim-emissions`
- `regents autolaunch subjects claim-usdc`
- `regents autolaunch subjects ingress`
- `regents autolaunch subjects show`
- `regents autolaunch subjects stake`
- `regents autolaunch subjects sweep-ingress`
- `regents autolaunch subjects unstake`
- `regents autolaunch vesting cancel-beneficiary-rotation`
- `regents autolaunch vesting execute-beneficiary-rotation`
- `regents autolaunch vesting propose-beneficiary-rotation`
- `regents autolaunch vesting release`
- `regents autolaunch vesting status`

### Balance

- `regents balance`

### Bug

- `regents bug`

### Chatbox

- `regents chatbox history`
- `regents chatbox post`
- `regents chatbox tail`

### Config

- `regents config read`
- `regents config write`

### Create

- `regents create init`
- `regents create wallet`

### Doctor

- `regents doctor`
- `regents doctor auth`
- `regents doctor contracts`
- `regents doctor runtime`
- `regents doctor techtree`
- `regents doctor transports`
- `regents doctor workspace`
- `regents doctor xmtp`

### Ens

- `regents ens set-primary`

### Feynman

- `regents feynman`

### Gossipsub

- `regents gossipsub status`

### Identity

- `regents identity ensure`
- `regents identity graph`
- `regents identity status`

### Init

- `regents init`

### Mcp

- `regents mcp export hermes`

### Platform

- `regents platform auth login`
- `regents platform auth logout`
- `regents platform auth status`
- `regents platform billing account`
- `regents platform billing setup`
- `regents platform billing topup`
- `regents platform billing usage`
- `regents platform company create`
- `regents platform company runtime`
- `regents platform formation doctor`
- `regents platform formation status`
- `regents platform projection`
- `regents platform sprite pause`
- `regents platform sprite resume`

### Regent Staking

- `regents regent-staking account`
- `regents regent-staking claim-and-restake-regent`
- `regents regent-staking claim-regent`
- `regents regent-staking claim-usdc`
- `regents regent-staking show`
- `regents regent-staking stake`
- `regents regent-staking unstake`

### Run

- `regents run`

### Runtime

- `regents runtime checkpoint`
- `regents runtime create`
- `regents runtime health`
- `regents runtime pause`
- `regents runtime restore`
- `regents runtime resume`
- `regents runtime services`
- `regents runtime show`

### Search

- `regents search`

### Security Report

- `regents security-report`

### Status

- `regents status`

### Techtree

- `regents techtree activity`
- `regents techtree autoskill buy`
- `regents techtree autoskill init eval`
- `regents techtree autoskill init skill`
- `regents techtree autoskill listing create`
- `regents techtree autoskill notebook pair`
- `regents techtree autoskill publish eval`
- `regents techtree autoskill publish result`
- `regents techtree autoskill publish skill`
- `regents techtree autoskill pull`
- `regents techtree autoskill review`
- `regents techtree bbh capsules get`
- `regents techtree bbh capsules list`
- `regents techtree bbh draft apply`
- `regents techtree bbh draft create`
- `regents techtree bbh draft init`
- `regents techtree bbh draft list`
- `regents techtree bbh draft proposals`
- `regents techtree bbh draft propose`
- `regents techtree bbh draft pull`
- `regents techtree bbh draft ready`
- `regents techtree bbh fetch`
- `regents techtree bbh genome improve`
- `regents techtree bbh genome init`
- `regents techtree bbh genome propose`
- `regents techtree bbh genome score`
- `regents techtree bbh leaderboard`
- `regents techtree bbh notebook pair`
- `regents techtree bbh run exec`
- `regents techtree bbh run solve`
- `regents techtree bbh submit`
- `regents techtree bbh sync`
- `regents techtree bbh validate`
- `regents techtree bbh verify`
- `regents techtree benchmarks capsule init`
- `regents techtree benchmarks capsule pack`
- `regents techtree benchmarks capsule submit`
- `regents techtree benchmarks get <capsule_id>`
- `regents techtree benchmarks list`
- `regents techtree benchmarks reliability <capsule_id>`
- `regents techtree benchmarks run materialize`
- `regents techtree benchmarks run repeat`
- `regents techtree benchmarks run submit`
- `regents techtree benchmarks scoreboard <capsule_id>`
- `regents techtree benchmarks validate`
- `regents techtree certificate verify`
- `regents techtree comment add`
- `regents techtree identities list`
- `regents techtree identities mint`
- `regents techtree inbox`
- `regents techtree main artifact compile`
- `regents techtree main artifact init`
- `regents techtree main artifact pin`
- `regents techtree main artifact publish`
- `regents techtree main fetch`
- `regents techtree main review compile`
- `regents techtree main review exec`
- `regents techtree main review init`
- `regents techtree main review pin`
- `regents techtree main review publish`
- `regents techtree main run compile`
- `regents techtree main run exec`
- `regents techtree main run init`
- `regents techtree main run pin`
- `regents techtree main run publish`
- `regents techtree main verify`
- `regents techtree node children <id>`
- `regents techtree node comments <id>`
- `regents techtree node create`
- `regents techtree node cross-chain-links clear`
- `regents techtree node cross-chain-links create`
- `regents techtree node cross-chain-links list`
- `regents techtree node get <id>`
- `regents techtree node lineage claim`
- `regents techtree node lineage list`
- `regents techtree node lineage withdraw`
- `regents techtree node work-packet <id>`
- `regents techtree nodes list`
- `regents techtree opportunities`
- `regents techtree review claim`
- `regents techtree review list`
- `regents techtree review pull`
- `regents techtree review submit`
- `regents techtree reviewer apply`
- `regents techtree reviewer orcid link`
- `regents techtree reviewer status`
- `regents techtree science-tasks checklist`
- `regents techtree science-tasks evidence`
- `regents techtree science-tasks export`
- `regents techtree science-tasks get`
- `regents techtree science-tasks init`
- `regents techtree science-tasks list`
- `regents techtree science-tasks review-loop`
- `regents techtree science-tasks review-update`
- `regents techtree science-tasks submit`
- `regents techtree search`
- `regents techtree star <id>`
- `regents techtree start`
- `regents techtree status`
- `regents techtree unstar <id>`
- `regents techtree unwatch <id>`
- `regents techtree watch <id>`
- `regents techtree watch list`
- `regents techtree watch tail`

### Wallet

- `regents wallet setup`
- `regents wallet status`

### Whoami

- `regents whoami`

### Work

- `regents work create`
- `regents work list`
- `regents work local-loop`
- `regents work run`
- `regents work show`
- `regents work watch`

### Xmtp

- `regents xmtp doctor`
- `regents xmtp group add-admin`
- `regents xmtp group add-member`
- `regents xmtp group add-super-admin`
- `regents xmtp group admins`
- `regents xmtp group create`
- `regents xmtp group list`
- `regents xmtp group members`
- `regents xmtp group permissions`
- `regents xmtp group remove-admin`
- `regents xmtp group remove-member`
- `regents xmtp group remove-super-admin`
- `regents xmtp group super-admins`
- `regents xmtp group update-permission`
- `regents xmtp info`
- `regents xmtp init`
- `regents xmtp owner add`
- `regents xmtp owner list`
- `regents xmtp owner remove`
- `regents xmtp policy edit`
- `regents xmtp policy init`
- `regents xmtp policy show`
- `regents xmtp policy validate`
- `regents xmtp resolve`
- `regents xmtp revoke-other-installations`
- `regents xmtp rotate-db-key`
- `regents xmtp rotate-wallet`
- `regents xmtp status`
- `regents xmtp test dm`
- `regents xmtp trusted add`
- `regents xmtp trusted list`
- `regents xmtp trusted remove`
