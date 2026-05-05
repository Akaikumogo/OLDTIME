import { uid, pick, int, resetSeed } from "./_rng";
import { computers } from "./computers";

export type AppCategory = "Productivity" | "Development" | "Design" | "Communication" | "Browser" | "Other";
export type AppUsage = {
  id: string;
  computerId: string;
  app: string;
  category: AppCategory;
  startedAt: Date;
  durationMinutes: number;
};

const APPS: { name: string; category: AppCategory }[] = [
  { name: "VS Code", category: "Development" },
  { name: "WebStorm", category: "Development" },
  { name: "Postman", category: "Development" },
  { name: "Figma", category: "Design" },
  { name: "Adobe XD", category: "Design" },
  { name: "Slack", category: "Communication" },
  { name: "Zoom", category: "Communication" },
  { name: "Microsoft Teams", category: "Communication" },
  { name: "Chrome", category: "Browser" },
  { name: "Safari", category: "Browser" },
  { name: "Excel", category: "Productivity" },
  { name: "Notion", category: "Productivity" },
  { name: "Linear", category: "Productivity" },
  { name: "Spotify", category: "Other" },
  { name: "Terminal", category: "Development" },
];

resetSeed(23);

export const computerActivity: AppUsage[] = [];
let counter = 0;
for (const c of computers) {
  // generate sessions over the last 7 days
  for (let d = 0; d < 7; d++) {
    if (!c.online && d < 1) continue;
    const sessions = int(4, 11);
    for (let s = 0; s < sessions; s++) {
      const start = new Date();
      start.setDate(start.getDate() - d);
      start.setHours(int(8, 19), int(0, 59), 0, 0);
      const app = pick(APPS);
      computerActivity.push({
        id: uid("act", ++counter),
        computerId: c.id,
        app: app.name,
        category: app.category,
        startedAt: start,
        durationMinutes: int(5, 95),
      });
    }
  }
}
computerActivity.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
