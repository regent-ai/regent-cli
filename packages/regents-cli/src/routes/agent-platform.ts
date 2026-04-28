import {
  runAgentConnectHermes,
  runAgentConnectOpenClaw,
  runAgentExecutionPool,
  runAgentLink,
} from "../commands/platform/agent-link.js";
import { route, type CliRoute } from "./shared.js";

export const agentPlatformRoutes: readonly CliRoute[] = [
  route("agent connect hermes", async ({ parsedArgs, configPath }) => {
    await runAgentConnectHermes(parsedArgs, configPath);
    return 0;
  }),
  route("agent connect openclaw", async ({ parsedArgs, configPath }) => {
    await runAgentConnectOpenClaw(parsedArgs, configPath);
    return 0;
  }),
  route("agent link", async ({ parsedArgs }) => {
    await runAgentLink(parsedArgs);
    return 0;
  }),
  route("agent execution-pool", async ({ parsedArgs }) => {
    await runAgentExecutionPool(parsedArgs);
    return 0;
  }),
];
