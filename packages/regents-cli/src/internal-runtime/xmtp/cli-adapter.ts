import { execFile as execFileCallback, spawn, type ChildProcessByStdio } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import type { RegentConfig } from "../../internal-types/index.js";

import { RegentError } from "../errors.js";

const execFile = promisify(execFileCallback);
const require = createRequire(import.meta.url);

const resolveXmtpCliPackageJsonPath = (): string => {
  let mainPath: string;
  try {
    mainPath = require.resolve("@xmtp/cli");
  } catch (error) {
    throw new RegentError("xmtp_cli_missing", "missing @xmtp/cli dependency in runtime workspace", error);
  }

  let currentDir = path.dirname(mainPath);
  while (currentDir !== path.dirname(currentDir)) {
    const candidate = path.join(currentDir, "package.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    currentDir = path.dirname(currentDir);
  }

  throw new RegentError("xmtp_cli_missing", "unable to resolve the @xmtp/cli package root");
};

const resolveXmtpCliBinPath = (): string => {
  const packageJsonPath = resolveXmtpCliPackageJsonPath();
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { bin?: { xmtp?: string } };
  const relativeBin = packageJson.bin?.xmtp;

  if (!relativeBin) {
    throw new RegentError("xmtp_cli_missing", "unable to resolve the xmtp CLI binary from @xmtp/cli");
  }

  return path.resolve(path.dirname(packageJsonPath), relativeBin);
};

const readRequiredFile = (filePath: string, kind: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new RegentError("xmtp_not_initialized", `missing XMTP ${kind} at ${filePath}; run \`regents xmtp init\``);
  }

  return fs.readFileSync(filePath, "utf8").trim();
};

export const cliConnectionArgs = (config: RegentConfig["xmtp"]): string[] => {
  const walletKey = readRequiredFile(config.walletKeyPath, "wallet key");
  const dbEncryptionKey = readRequiredFile(config.dbEncryptionKeyPath, "database encryption key");

  return [
    "--env",
    config.env,
    "--wallet-key",
    walletKey,
    "--db-encryption-key",
    dbEncryptionKey,
    "--db-path",
    config.dbPath,
    "--log-level",
    "off",
  ];
};

export const spawnXmtpCliProcess = (
  config: RegentConfig["xmtp"],
  args: string[],
): ChildProcessByStdio<null, import("node:stream").Readable, import("node:stream").Readable> => {
  return spawn(process.execPath, [resolveXmtpCliBinPath(), ...args, ...cliConnectionArgs(config)], {
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
};

export const runXmtpCli = async (args: string[]): Promise<string> => {
  try {
    const { stdout } = await execFile(process.execPath, [resolveXmtpCliBinPath(), ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      maxBuffer: 1024 * 1024 * 4,
    });

    return stdout.trim();
  } catch (error) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    throw new RegentError(
      "xmtp_cli_error",
      failure.stderr?.trim() || failure.stdout?.trim() || failure.message || "xmtp CLI command failed",
      error,
    );
  }
};

export const runConnectedXmtpCli = async (config: RegentConfig["xmtp"], args: string[]): Promise<string> => {
  return runXmtpCli([...args, ...cliConnectionArgs(config)]);
};

export const runConnectedXmtpCliJson = async <T>(config: RegentConfig["xmtp"], args: string[]): Promise<T> => {
  const stdout = await runConnectedXmtpCli(config, [...args, "--json"]);
  return JSON.parse(stdout) as T;
};
