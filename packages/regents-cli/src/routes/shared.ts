import { CLI_COMMANDS } from "../command-registry.js";
import type { ParsedCliArgs } from "../parse.js";

export type CliRouteContext = {
  rawArgs: string[];
  parsedArgs: ParsedCliArgs;
  configPath: string | undefined;
  positionals: readonly string[];
};

export type CliRouteHandler = (context: CliRouteContext) => Promise<number>;

export type CliRoute = {
  command: string;
  pattern: readonly string[];
  handler: CliRouteHandler;
};

export const route = (pattern: string, handler: CliRouteHandler): CliRoute => ({
  command: pattern,
  pattern: pattern.split(" "),
  handler,
});

export const routeMatches = (routePattern: readonly string[], positionals: readonly string[]): boolean => {
  if (routePattern.length > positionals.length) {
    return false;
  }

  return routePattern.every((part, index) => {
    const input = positionals[index];
    return part.startsWith("<") && part.endsWith(">") ? Boolean(input) : part === input;
  });
};

export const dispatchRoute = async (
  routes: readonly CliRoute[],
  context: CliRouteContext,
): Promise<number | undefined> => {
  const matchedRoute = routes.find((candidate) => routeMatches(candidate.pattern, context.positionals));
  return matchedRoute ? matchedRoute.handler(context) : undefined;
};

export const assertRouteRegistryMatches = (routes: readonly CliRoute[]): void => {
  const routeCommands = routes.map((candidate) => candidate.command).sort();
  const registryCommands = [...CLI_COMMANDS].sort();
  const routeCommandSet = new Set(routeCommands);
  const routeCommandsWithoutPlaceholders = new Set(
    routeCommands.map((command) =>
      command
        .split(" ")
        .filter((part) => !(part.startsWith("<") && part.endsWith(">")))
        .join(" "),
    ),
  );
  const registryCommandSet = new Set<string>(registryCommands);
  const missingRoutes = registryCommands.filter(
    (command) => !routeCommandSet.has(command) && !routeCommandsWithoutPlaceholders.has(command),
  );
  const missingRegistryEntries = routeCommands.filter((command) => {
    const commandWithoutPlaceholders = command
      .split(" ")
      .filter((part) => !(part.startsWith("<") && part.endsWith(">")))
      .join(" ");
    return !registryCommandSet.has(command) && !registryCommandSet.has(commandWithoutPlaceholders);
  });

  if (missingRoutes.length > 0 || missingRegistryEntries.length > 0) {
    throw new Error(
      [
        missingRoutes.length > 0 ? `CLI registry commands missing routes: ${missingRoutes.join(", ")}` : undefined,
        missingRegistryEntries.length > 0
          ? `CLI routes missing registry commands: ${missingRegistryEntries.join(", ")}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
};
