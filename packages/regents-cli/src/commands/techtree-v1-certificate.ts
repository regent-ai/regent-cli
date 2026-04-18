import type { ParsedCliArgs } from "../parse.js";

import { daemonCall } from "../daemon-client.js";
import { getFlag, requireArg } from "../parse.js";
import { printJson } from "../printer.js";

export async function runTechtreeCertificateVerify(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.certificate.verify",
      {
        capsule_id: requireArg(getFlag(args, "capsule-id") ?? args.positionals[3], "capsule id"),
      },
      configPath,
    ),
  );
}
