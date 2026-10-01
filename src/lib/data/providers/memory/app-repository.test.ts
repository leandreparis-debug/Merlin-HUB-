import { runAppRepositoryContract } from "@/lib/data/contract/app-repository.contract";
import { createMemoryAppRepository } from "@/lib/data/providers/memory/app-repository";
import { createMemoryStore } from "@/lib/data/providers/memory/store";

runAppRepositoryContract(() => createMemoryAppRepository(createMemoryStore()));
