import type { ParsedCliArgs } from "../parse.js";

import { exportHermesMcp } from "../internal-runtime/coinbase.js";
import { getBooleanFlag } from "../parse.js";
import { printJson, printText } from "../printer.js";

export async function runMcpExportHermes(
  args: readonly string[] | ParsedCliArgs,
): Promise<number> {
  const payload = exportHermesMcp();
  if (getBooleanFlag(args, "json")) {
    printJson(payload);
  } else {
    printText(JSON.stringify(payload, null, 2));
  }
  return 0;
}
