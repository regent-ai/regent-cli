import fs from "node:fs";
import path from "node:path";

export const TEST_COINBASE_WALLET = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
export const TEST_COINBASE_SIGNATURE = `0x${"1".repeat(130)}`;

export const writeFakeCdp = (dir: string): string => {
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const scriptPath = path.join(binDir, "cdp");
  fs.writeFileSync(
    scriptPath,
    `#!/bin/bash
set -euo pipefail

if [[ "$#" -ge 4 && "$1" == "evm" && "$2" == "accounts" && "$3" == "by-name" && "$4" == "main" ]]; then
  printf '{"name":"main","address":"${TEST_COINBASE_WALLET}"}\\n'
  exit 0
fi

if [[ "$#" -ge 3 && "$1" == "evm" && "$2" == "accounts" && "$3" == "list" ]]; then
  printf '{"accounts":[{"name":"main","address":"${TEST_COINBASE_WALLET}"}]}\\n'
  exit 0
fi

if [[ "$#" -ge 4 && "$1" == "evm" && "$2" == "accounts" && "$3" == "create" ]]; then
  printf '{"name":"main","address":"${TEST_COINBASE_WALLET}"}\\n'
  exit 0
fi

if [[ "$#" -ge 5 && "$1" == "evm" && "$2" == "accounts" && "$3" == "sign" && "$4" == "message" ]]; then
  printf '{"signature":"${TEST_COINBASE_SIGNATURE}"}\\n'
  exit 0
fi

if [[ "$#" -ge 1 && "$1" == "mcp" ]]; then
  printf '{"ok":true}\\n'
  exit 0
fi

echo "unsupported cdp command: $*" >&2
exit 1
`,
    "utf8",
  );
  fs.chmodSync(scriptPath, 0o755);
  return binDir;
};
