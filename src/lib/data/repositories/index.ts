import type { ActivityLogRepository } from "@/lib/data/repositories/activity-log-repository";
import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";
import type { AppRepository } from "@/lib/data/repositories/app-repository";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";
import type { ReportRepository } from "@/lib/data/repositories/report-repository";

export type { ActivityLogRepository } from "@/lib/data/repositories/activity-log-repository";
export type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";
export type { AppRepository } from "@/lib/data/repositories/app-repository";
export type { ProfileRepository } from "@/lib/data/repositories/profile-repository";
export type { ReportRepository } from "@/lib/data/repositories/report-repository";

/** Regroupe toutes les interfaces de repository exposées par la fabrique de données (`src/lib/data/index.ts`). */
export interface Repositories {
  profiles: ProfileRepository;
  apps: AppRepository;
  announcements: AnnouncementRepository;
  reports: ReportRepository;
  activityLog: ActivityLogRepository;
}
