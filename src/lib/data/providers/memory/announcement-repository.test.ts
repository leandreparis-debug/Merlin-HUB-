import { runAnnouncementRepositoryContract } from "@/lib/data/contract/announcement-repository.contract";
import { createMemoryAnnouncementRepository } from "@/lib/data/providers/memory/announcement-repository";
import { createMemoryStore } from "@/lib/data/providers/memory/store";

runAnnouncementRepositoryContract(() =>
  createMemoryAnnouncementRepository(createMemoryStore()),
);
