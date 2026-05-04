import { feynmanArgsFromRawArgs, runFeynman } from "../commands/feynman.js";
import { route, type CliRoute } from "./shared.js";

export const feynmanRoutes: readonly CliRoute[] = [
  route("feynman", async ({ rawArgs }) => runFeynman(feynmanArgsFromRawArgs(rawArgs)), {
    variadicTail: true,
  }),
];
