import { runProfileRepositoryContract } from "@/lib/data/contract/profile-repository.contract";
import { createMemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";
import { createMemoryStore } from "@/lib/data/providers/memory/store";

runProfileRepositoryContract(() => {
  const repo = createMemoryProfileRepository(createMemoryStore());
  return { repo, createProfile: (input) => repo.createForTests(input) };
});
