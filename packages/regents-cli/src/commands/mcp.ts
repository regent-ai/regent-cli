import type { ParsedCliArgs } from "../parse.js";

import { exportHermesMcp } from "../internal-runtime/coinbase.js";
import { printJson } from "../printer.js";

export async function runMcpExportHermes(
  args: readonly string[] | ParsedCliArgs,
): Promise<number> {
  const payload = exportHermesMcp();
  printJson(payload);
  return 0;
}
