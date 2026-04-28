import {
  runWorkCreate,
  runWorkList,
  runWorkRun,
  runWorkShow,
  runWorkWatch,
} from "../commands/work.js";
import { route, type CliRoute } from "./shared.js";

export const workRoutes: readonly CliRoute[] = [
  route("work create", async ({ parsedArgs }) => {
    await runWorkCreate(parsedArgs);
    return 0;
  }),
  route("work list", async ({ parsedArgs }) => {
    await runWorkList(parsedArgs);
    return 0;
  }),
  route("work show", async ({ parsedArgs }) => {
    await runWorkShow(parsedArgs);
    return 0;
  }),
  route("work run", async ({ parsedArgs }) => {
    await runWorkRun(parsedArgs);
    return 0;
  }),
  route("work watch", async ({ parsedArgs }) => {
    await runWorkWatch(parsedArgs);
    return 0;
  }),
];
