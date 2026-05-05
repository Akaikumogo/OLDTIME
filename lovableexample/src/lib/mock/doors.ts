import { uid } from "./_rng";

export type DoorType = "entry" | "exit" | "bidirectional";
export type Door = {
  id: string;
  name: string;
  location: string;
  type: DoorType;
  ip: string;
  online: boolean;
  lastEventAt: Date;
};

const data: Omit<Door, "id">[] = [
  { name: "Main Entrance", location: "Building A · Floor 1", type: "bidirectional", ip: "10.0.10.21", online: true, lastEventAt: new Date(Date.now() - 1000 * 60 * 3) },
  { name: "Back Entrance", location: "Building A · Floor 1", type: "entry", ip: "10.0.10.22", online: true, lastEventAt: new Date(Date.now() - 1000 * 60 * 18) },
  { name: "Server Room", location: "Building A · Floor 2", type: "bidirectional", ip: "10.0.10.31", online: true, lastEventAt: new Date(Date.now() - 1000 * 60 * 47) },
  { name: "R&D Floor 3", location: "Building A · Floor 3", type: "bidirectional", ip: "10.0.10.41", online: false, lastEventAt: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  { name: "Garage Gate", location: "Parking", type: "exit", ip: "10.0.20.11", online: true, lastEventAt: new Date(Date.now() - 1000 * 60 * 9) },
  { name: "Rooftop Access", location: "Building A · Roof", type: "bidirectional", ip: "10.0.10.51", online: true, lastEventAt: new Date(Date.now() - 1000 * 60 * 60 * 12) },
  { name: "Warehouse Door", location: "Building B · Floor 1", type: "bidirectional", ip: "10.0.30.11", online: false, lastEventAt: new Date(Date.now() - 1000 * 60 * 60 * 28) },
];

export const doors: Door[] = data.map((d, i) => ({ id: uid("door", i + 1), ...d }));
