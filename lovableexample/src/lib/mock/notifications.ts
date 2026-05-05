export type Notification = {
  id: string;
  title: string;
  message: string;
  at: Date;
  read: boolean;
};

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Door offline",
    message: "R&D Floor 3 has been offline for 5 hours.",
    at: new Date(Date.now() - 1000 * 60 * 18),
    read: false,
  },
  {
    id: "n2",
    title: "Permission requested",
    message: "Yuki Tanaka requested 2 days leave.",
    at: new Date(Date.now() - 1000 * 60 * 47),
    read: false,
  },
  {
    id: "n3",
    title: "Late arrivals report",
    message: "8 employees arrived late today.",
    at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
  },
  {
    id: "n4",
    title: "Computer added",
    message: "wp-eng-041 was registered to Liam O'Connor.",
    at: new Date(Date.now() - 1000 * 60 * 60 * 6),
    read: true,
  },
  {
    id: "n5",
    title: "Weekly summary ready",
    message: "Last week's attendance report is available.",
    at: new Date(Date.now() - 1000 * 60 * 60 * 26),
    read: true,
  },
];
