import { runChatboxHistory, runChatboxPost, runChatboxTail } from "../commands/chatbox.js";
import { route, type CliRoute } from "./shared.js";

export const chatboxRoutes: readonly CliRoute[] = [
  route("chatbox history", async ({ parsedArgs, configPath }) => {
    await runChatboxHistory(parsedArgs, configPath);
    return 0;
  }),
  route("chatbox tail", async ({ parsedArgs, configPath }) => {
    await runChatboxTail(parsedArgs, configPath);
    return 0;
  }),
  route("chatbox post", async ({ parsedArgs, configPath }) => {
    await runChatboxPost(parsedArgs, configPath);
    return 0;
  }),
];
