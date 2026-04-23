#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { knownCliCommand } from "./command-registry.js";
import { defaultConfigPath, expandHome } from "./internal-runtime/index.js";
import { getFlag, parseCliArgs } from "./parse.js";
import { printError, printText, renderUsageScreen } from "./printer.js";
import { cliRoutes, dispatchRoute, type CliRouteContext } from "./routes/index.js";

export const parseConfigPath = (args: string[]): string | undefined => {
  const configFlag = getFlag(args, "config");
  return configFlag ? expandHome(configFlag) : undefined;
};

const usage = (configPath?: string): void => {
  printText(renderUsageScreen(configPath ?? defaultConfigPath()));
};

export async function runCliEntrypoint(rawArgs: string[]): Promise<number> {
  try {
    const parsedArgs = parseCliArgs(rawArgs);
    const configPath = parseConfigPath(rawArgs);
    const [namespace] = parsedArgs.positionals;

    if (!namespace || rawArgs.includes("--help") || rawArgs.includes("-h")) {
      usage(configPath);
      return 0;
    }

    const routeContext: CliRouteContext = {
      rawArgs,
      parsedArgs,
      configPath,
      positionals: parsedArgs.positionals,
    };

    const routedResult = await dispatchRoute(cliRoutes, routeContext);
    if (routedResult !== undefined) {
      return routedResult;
    }

    const enteredCommand = parsedArgs.positionals.join(" ");
    throw new Error(
      knownCliCommand(parsedArgs.positionals)
        ? `Command is not available yet: ${enteredCommand}`
        : `Unknown command: ${enteredCommand}`,
    );
  } catch (error) {
    printError(error);
    return 1;
  }
}

export async function runCli(rawArgs: string[] = process.argv.slice(2)): Promise<number | void> {
  return runCliEntrypoint(rawArgs);
}

const main = async (): Promise<void> => {
  const exitCode = await runCliEntrypoint(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
};

const isMainModule = (): boolean => {
  const invokedPath = process.argv[1];
  if (!invokedPath) {
    return false;
  }

  const currentModulePath = fileURLToPath(import.meta.url);

  try {
    return fs.realpathSync(invokedPath) === fs.realpathSync(currentModulePath);
  } catch {
    return path.resolve(invokedPath) === path.resolve(currentModulePath);
  }
};

if (isMainModule()) {
  void main();
}
