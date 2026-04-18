import { RegentError } from "./internal-runtime/index.js";

const rgb = (r: number, g: number, b: number): string => `\x1b[38;2;${r};${g};${b}m`;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  charcoalBlue: rgb(49, 85, 105),
  yaleBlue: rgb(3, 69, 104),
  ivoryMist: rgb(251, 244, 222),
  sunlitClay: rgb(212, 167, 86),
  greyOlive: rgb(132, 128, 120),
} as const;

export const CLI_PALETTE = {
  chrome: ANSI.charcoalBlue,
  title: ANSI.ivoryMist,
  accent: ANSI.sunlitClay,
  primary: ANSI.ivoryMist,
  secondary: ANSI.greyOlive,
  emphasis: ANSI.yaleBlue,
  error: ANSI.sunlitClay,
} as const;

const BORDER = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
} as const;

const stripAnsi = (value: string): string => value.replace(/\x1b\[[0-9;]*m/g, "");

export const isHumanTerminal = (): boolean => Boolean(process.stdout.isTTY) && process.env.NO_COLOR !== "1";

export const tone = (value: string, color: string, bold = false): string => {
  const prefix = `${bold ? ANSI.bold : ""}${color}`;
  return `${prefix}${value}${ANSI.reset}`;
};

const padRight = (value: string, width: number): string => {
  const visible = stripAnsi(value).length;
  return visible >= width ? value : `${value}${" ".repeat(width - visible)}`;
};

export const renderPanel = (
  title: string,
  lines: string[],
  options?: { borderColor?: string; titleColor?: string },
): string => {
  const contentWidth = Math.max(stripAnsi(title).length, ...lines.map((line) => stripAnsi(line).length), 24);
  const horizontal = BORDER.horizontal.repeat(contentWidth + 2);
  const borderColor = options?.borderColor ?? CLI_PALETTE.chrome;
  const titleColor = options?.titleColor ?? CLI_PALETTE.title;

  const top = `${borderColor}${BORDER.topLeft}${BORDER.horizontal} ${tone(title, titleColor, true)} ${horizontal.slice(stripAnsi(title).length + 1)}${BORDER.topRight}${ANSI.reset}`;
  const body = lines.map((line) => `${borderColor}${BORDER.vertical}${ANSI.reset} ${padRight(line, contentWidth)} ${borderColor}${BORDER.vertical}${ANSI.reset}`);
  const bottom = `${borderColor}${BORDER.bottomLeft}${horizontal}${BORDER.bottomRight}${ANSI.reset}`;

  return [top, ...body, bottom].join("\n");
};

const highlightJsonLine = (line: string): string => {
  let highlighted = line;
  highlighted = highlighted.replace(/^(\s*)"([^"]+)":/u, (_, indent: string, key: string) =>
    `${indent}${tone(`"${key}"`, CLI_PALETTE.emphasis, true)}${tone(":", CLI_PALETTE.secondary)}`,
  );
  highlighted = highlighted.replace(/: ("(?:[^"\\]|\\.)*")/gu, (_match, value: string) => `: ${tone(value, CLI_PALETTE.primary)}`);
  highlighted = highlighted.replace(/: (-?\d+(?:\.\d+)?)/gu, (_match, value: string) => `: ${tone(value, CLI_PALETTE.accent, true)}`);
  highlighted = highlighted.replace(/: (true|false)\b/gu, (_match, value: string) => `: ${tone(value, CLI_PALETTE.emphasis, true)}`);
  highlighted = highlighted.replace(/: (null)\b/gu, (_match, value: string) => `: ${tone(value, CLI_PALETTE.secondary)}`);
  return highlighted;
};

const jsonTitle = (value: unknown): string => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.error) {
      return "◆ REGENT ERROR DECK";
    }
    if (record.usage) {
      return "◆ REGENT COMMAND DECK";
    }
    if (record.data) {
      return "◆ REGENT DATA DECK";
    }
  }

  return "◆ REGENT OUTPUT DECK";
};

const humanJson = (value: unknown): string => {
  const raw = JSON.stringify(value, null, 2).split("\n");
  const lines = raw.map((line) => (line.length > 0 ? highlightJsonLine(line) : ""));
  return renderPanel(jsonTitle(value), lines, {
    borderColor: CLI_PALETTE.chrome,
    titleColor: CLI_PALETTE.title,
  });
};

const renderUsageGroup = (title: string, commands: string[]): string[] => [
  tone(`▶ ${title}`, CLI_PALETTE.accent, true),
  ...commands.map((command) => `${tone("•", CLI_PALETTE.emphasis)} ${command}`),
  "",
];

const renderUsageNotes = (title: string, notes: string[]): string[] => [
  tone(`▷ ${title}`, CLI_PALETTE.secondary, true),
  ...notes.map((note) => `${tone("·", CLI_PALETTE.secondary)} ${note}`),
  "",
];

export function renderUsageScreen(configPath: string): string {
  const lines = [
    tone("local control layer for Regent", CLI_PALETTE.secondary),
    tone(`default config`, CLI_PALETTE.secondary) + ` ${tone(configPath, CLI_PALETTE.primary, true)}`,
    "",
    ...renderUsageNotes("Guided start first", [
      "use regents.sh/services for guided setup, billing, claimed names, and company launch",
      "use regents techtree start first for most Techtree setups",
      "it checks local config, the runtime, identity, Techtree readiness, and BBH readiness",
      "when that finishes, move into the next Techtree task or the BBH branch you need",
      "drop to the lower-level commands below only when you need tighter control",
    ]),
    ...renderUsageGroup("Start Here", [
      "regents techtree start",
      "regents run",
      "regents create init",
      "regents create wallet",
      "regents doctor",
      "regents config read",
      "regents config write",
    ]),
    ...renderUsageGroup("Identity + Lower-Level Setup", [
      "regents identity ensure",
      "regents agent init",
      "regents agent status",
      "regents techtree identities list",
      "regents techtree identities mint",
    ]),
    ...renderUsageGroup("Techtree Next Commands", [
      "regents techtree status",
      "regents techtree activity",
      "regents techtree search",
      "regents techtree nodes list",
      "regents techtree node lineage list <id>",
      "regents techtree node lineage claim <id> --input @file.json",
      "regents techtree node lineage withdraw <id> --claim-id <claim-id>",
      "regents techtree node cross-chain-links list <id>",
      "regents techtree node cross-chain-links create <id> --input @file.json",
      "regents techtree node cross-chain-links clear <id>",
      "regents techtree node create ... [--cross-chain-link @file.json] [--paid-payload @file.json]",
      "regents techtree comment add --node-id <id> --body-markdown ...",
      "regents techtree autoskill init skill [path]",
      "regents techtree autoskill notebook pair [path]",
      "regents techtree autoskill publish skill [path]",
      "regents techtree autoskill publish eval [path]",
      "regents techtree autoskill publish result [path] --skill-node-id ... --eval-node-id ...",
      "regents techtree autoskill review --kind community|replicable --skill-node-id ...",
      "regents techtree autoskill listing create --skill-node-id ... --price-usdc ...",
      "regents techtree autoskill buy <node-id>",
      "regents techtree autoskill pull <node-id> [path]",
      "regents chatbox history --webapp|--agent",
      "regents chatbox tail --webapp|--agent",
      "regents chatbox post --body ...",
    ]),
    ...renderUsageGroup("BBH Next Loop", [
      "regents techtree bbh capsules list [--lane climb|benchmark|challenge]",
      "regents techtree bbh capsules get <capsule-id>",
      "regents techtree bbh run exec [path] --capsule <capsule-id> [--lane climb|benchmark|challenge]",
      "regents techtree bbh notebook pair [path]",
      "regents techtree bbh run solve [path] --solver hermes|openclaw|skydiscover",
      "regents techtree bbh draft init [path]",
      "regents techtree bbh draft create [path] --title ...",
      "regents techtree bbh genome init [path] [--lane climb|benchmark|challenge] [--sample-size 3] [--budget 6]",
      "regents techtree bbh genome score [path]",
      "regents techtree bbh genome improve [path]",
      "regents techtree bbh genome propose <capsule-id> [path]",
      "regents techtree reviewer orcid link",
      "regents techtree review list --kind certification",
      "regents techtree certificate verify <capsule-id>",
      "regents techtree bbh submit [path]",
      "regents techtree bbh validate [path]",
      "regents techtree bbh leaderboard --lane benchmark",
      "regents techtree bbh sync",
    ]),
    ...renderUsageNotes("BBH after setup", [
      "run exec -> notebook pair -> run solve --solver ... -> submit -> validate",
      "run exec creates the BBH run folder",
      "SkyDiscover adds the search pass inside the run folder",
      "Hypotest scores the run and checks replay during validation",
    ]),
    ...renderUsageGroup("Messaging + Adjacent Work", [
      "regents bug --summary \"can't do xyz\" --details \"any more details here\"",
      "regents security-report --summary \"private vuln\" --details \"steps and impact\" --contact \"@xyz on telegram\"",
      "regents xmtp init",
      "regents xmtp status",
      "regents xmtp group permissions <conversation-id>",
      "regents xmtp group update-permission <conversation-id> --type add-member --policy admin",
      "regents xmtp group add-admin <conversation-id> --address <wallet>",
      "regents xmtp doctor",
      "regents autolaunch ...",
      "regents autolaunch safe wizard",
      "regents autolaunch safe create",
      "regents autolaunch trust x-link --agent <id>",
      "regents regent-staking ...",
      "regents agentbook ...",
      "regent gossipsub status",
    ]),
    tone("tip", CLI_PALETTE.secondary, true) + " add " + tone("--config /absolute/path.json", CLI_PALETTE.primary, true) + " to pin a non-default config.",
  ];

  return renderPanel("◆ R E G E N T   C L I", lines, {
    borderColor: CLI_PALETTE.chrome,
    titleColor: CLI_PALETTE.title,
  });
}

export function printJson(value: unknown): void {
  if (isHumanTerminal()) {
    process.stdout.write(`${humanJson(value)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printText(text: string): void {
  process.stdout.write(`${text}\n`);
}

const renderErrorPanel = (message: string, code?: string): string =>
  renderPanel(
    "◆ REGENT ERROR",
    [
      ...(code
        ? [`${tone("code", CLI_PALETTE.secondary)} ${tone(code, CLI_PALETTE.error, true)}`]
        : []),
      `${tone("message", CLI_PALETTE.secondary)} ${tone(message, CLI_PALETTE.primary, true)}`,
    ],
    { borderColor: CLI_PALETTE.error, titleColor: CLI_PALETTE.title },
  );

const errorPayload = (message: string, code?: string): Record<string, { code?: string; message: string }> => ({
  error: {
    ...(code ? { code } : {}),
    message,
  },
});

export function printError(error: unknown): void {
  if (error instanceof RegentError) {
    if (isHumanTerminal()) {
      process.stderr.write(`${renderErrorPanel(error.message, error.code)}\n`);
      return;
    }

    process.stderr.write(`${JSON.stringify(errorPayload(error.message, error.code), null, 2)}\n`);
    return;
  }

  if (error instanceof Error) {
    if (isHumanTerminal()) {
      process.stderr.write(`${renderErrorPanel(error.message)}\n`);
      return;
    }

    process.stderr.write(`${JSON.stringify(errorPayload(error.message), null, 2)}\n`);
    return;
  }

  const fallbackMessage = String(error);
  if (isHumanTerminal()) {
    process.stderr.write(`${renderErrorPanel(fallbackMessage)}\n`);
    return;
  }

  process.stderr.write(`${JSON.stringify(errorPayload(fallbackMessage), null, 2)}\n`);
}
