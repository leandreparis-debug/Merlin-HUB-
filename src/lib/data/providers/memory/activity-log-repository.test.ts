import { runActivityLogRepositoryContract } from "@/lib/data/contract/activity-log-repository.contract";
import { createMemoryActivityLogRepository } from "@/lib/data/providers/memory/activity-log-repository";
import { createMemoryStore } from "@/lib/data/providers/memory/store";

runActivityLogRepositoryContract(() =>
  createMemoryActivityLogRepository(createMemoryStore()),
);
