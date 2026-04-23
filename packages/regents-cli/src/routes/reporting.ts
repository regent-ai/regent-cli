import { runBugReport, runSecurityReport } from "../commands/reports.js";
import { route, type CliRoute } from "./shared.js";

export const reportingRoutes: readonly CliRoute[] = [
  route("bug", async ({ parsedArgs, configPath }) => {
    await runBugReport(parsedArgs, configPath);
    return 0;
  }),
  route("security-report", async ({ parsedArgs, configPath }) => {
    await runSecurityReport(parsedArgs, configPath);
    return 0;
  }),
];
