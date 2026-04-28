export interface OpenClawSkillTemplateInput {
  readonly companyId: string;
  readonly workerId: string;
  readonly workerName: string;
}

export const renderOpenClawRegentsWorkSkill = (input: OpenClawSkillTemplateInput): string => `---
name: regents-work
description: Use Regents CLI to create, run, and check Regent company work from a local OpenClaw agent.
---

# Regents Work

Use this skill when a person asks OpenClaw to help with Regent company work.

## Safety

Do not upload secrets, private memory, inbox content, calendar content, chat content, wallet material, keys, tokens, session files, or private company files unless the person explicitly asks for that exact content to be used.

When work needs private material, ask which exact files or messages may be used before reading or sending them.

## Company

- Company id: ${input.companyId}
- Worker id: ${input.workerId}
- Worker name: ${input.workerName}

## Commands

- Create work: \`regents work create --company-id ${input.companyId} --title "<title>" --description "<details>"\`
- Start work: \`regents work run <work_item_id> --company-id ${input.companyId} --runner openclaw_local_executor --worker-id ${input.workerId}\`
- Check a run: \`regents work watch <run_id> --company-id ${input.companyId}\`
- List available workers: \`regents agent execution-pool --company-id ${input.companyId} --manager <manager_agent_profile_id>\`

Prefer short, specific work titles. Put task details in the description or instructions fields.
`;
