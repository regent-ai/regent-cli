export interface LocalWorkerLoopHandlers<TAssignment> {
  readonly heartbeat: () => Promise<void>;
  readonly listAssignments: () => Promise<readonly TAssignment[]>;
  readonly handleAssignment: (assignment: TAssignment) => Promise<void>;
  readonly sleepMs?: number;
  readonly shouldContinue?: () => boolean;
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export const runLocalWorkerLoop = async <TAssignment>(
  handlers: LocalWorkerLoopHandlers<TAssignment>,
): Promise<void> => {
  const sleepMs = handlers.sleepMs ?? 5_000;

  while (handlers.shouldContinue?.() ?? true) {
    await handlers.heartbeat();
    const assignments = await handlers.listAssignments();

    for (const assignment of assignments) {
      await handlers.handleAssignment(assignment);
    }

    await sleep(sleepMs);
  }
};
