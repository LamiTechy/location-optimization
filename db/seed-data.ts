import type { LocationCategory, PathType } from "./schema";

/**
 * Placeholder campus layout used by `db/seed.ts`.
 *
 * Positions are stored as **metric offsets (metres east / north)** from
 * `CAMPUS_CENTER` so the graph is topologically believable; they are converted
 * to lat/lng at seed time. They are NOT surveyed GPS readings - see the notice
 * in README.md and the admin banner.
 */

export interface SeedPlace {
  key: string;
  name: string;
  category: LocationCategory;
  description: string;
  x: number;
  y: number;
  shortCode?: string;
  building?: string;
  floorInfo?: string;
  openingHours?: string;
}

export interface SeedJunction {
  key: string;
  label: string;
  x: number;
  y: number;
}

export interface SeedEdge {
  from: string;
  to: string;
  pathType?: PathType;
  isBidirectional?: boolean;
}

/** Junction (pure graph) nodes - they belong to no location. */
export const junctions: SeedJunction[] = [
  { key: "j1", label: "Campus Crossroads", x: 0, y: 0 },
  { key: "j2", label: "West Junction", x: -170, y: 10 },
  { key: "j3", label: "East Junction", x: 175, y: 5 },
  { key: "j4", label: "North Junction", x: 10, y: 150 },
  { key: "j5", label: "South Junction", x: 0, y: -165 },
  { key: "j6", label: "North-West Junction", x: -175, y: 145 },
  { key: "j7", label: "North-East Junction", x: 185, y: 150 },
  { key: "j8", label: "South-West Junction", x: -195, y: -150 },
  { key: "j9", label: "South-East Junction", x: 195, y: -155 },
  { key: "j10", label: "Far West Junction", x: -325, y: 55 },
  { key: "j11", label: "Far East Junction", x: 330, y: 60 },
  { key: "j12", label: "North Gate Approach", x: 55, y: 255 },
  { key: "j13", label: "Main Gate Approach", x: -45, y: -275 },
  { key: "j14", label: "Car Park Junction", x: 110, y: -245 },
];

/** The ~26 seeded campus places (report: Location database entries). */
export const places: SeedPlace[] = [
  {
    key: "main_gate",
    name: "MAPOLY Main Gate",
    category: "gate",
    description: "Main entrance to the campus from Ojere Road.",
    x: 25,
    y: -300,
    shortCode: "GATE",
    openingHours: "Open 24 hours",
  },
  {
    key: "admin_block",
    name: "Administrative Block",
    category: "office",
    description: "Rectorate, Bursary and registry offices.",
    x: -95,
    y: -55,
    shortCode: "ADM",
    building: "Administration Building",
    openingHours: "Mon-Fri 8:00-16:00",
  },
  {
    key: "senate",
    name: "Senate Building",
    category: "office",
    description: "Senate chamber and academic planning directorate.",
    x: 25,
    y: -95,
    shortCode: "SEN",
    building: "Senate Building",
    openingHours: "Mon-Fri 8:00-16:00",
  },
  {
    key: "bursary",
    name: "Bursary Department",
    category: "office",
    description: "Fees payment, budgets and payroll.",
    x: -75,
    y: -145,
    shortCode: "BUR",
    building: "Administration Building",
    openingHours: "Mon-Fri 8:00-16:00",
  },
  {
    key: "library",
    name: "Polytechnic Library",
    category: "library",
    description: "Main library with reading rooms and digital resources.",
    x: 85,
    y: 60,
    shortCode: "LIB",
    building: "Library Complex",
    openingHours: "Mon-Sat 8:00-21:00",
  },
  {
    key: "cs_dept",
    name: "Computer Science Department",
    category: "department",
    description: "ND and HND Computer Science lectures and offices.",
    x: 215,
    y: 105,
    shortCode: "CSC",
    building: "Science Block 2",
    floorInfo: "Ground & First floor",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "ict_centre",
    name: "ICT Centre",
    category: "department",
    description: "e-Learning studio, CBT practice and network operations.",
    x: 150,
    y: 190,
    shortCode: "ICT",
    building: "ICT Building",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "lab_cs",
    name: "Computer Science Laboratory",
    category: "laboratory",
    description: "Programming and networking practical laboratory.",
    x: 255,
    y: 140,
    shortCode: "CSC-L",
    building: "Science Block 2",
    floorInfo: "First floor",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "lab_science",
    name: "Science Laboratory 1",
    category: "laboratory",
    description: "General science practical laboratory.",
    x: 120,
    y: -45,
    shortCode: "LAB1",
    building: "Science Block 1",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "lab_physics",
    name: "Physics Laboratory",
    category: "laboratory",
    description: "Physics practical and demonstration lab.",
    x: 200,
    y: -85,
    shortCode: "PHY",
    building: "Science Block 1",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "workshop",
    name: "Engineering Workshop",
    category: "other",
    description: "Workshop for engineering practicals and projects.",
    x: -285,
    y: 40,
    shortCode: "WKS",
    building: "Workshop Block",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "lt_a",
    name: "Lecture Theatre A",
    category: "lecture_hall",
    description: "Large lecture theatre for general courses.",
    x: -155,
    y: 95,
    shortCode: "LTA",
    building: "Lecture Theatres",
    openingHours: "Mon-Sat 7:00-19:00",
  },
  {
    key: "lt_b",
    name: "Lecture Theatre B",
    category: "lecture_hall",
    description: "Second lecture theatre beside LT A.",
    x: -235,
    y: 175,
    shortCode: "LTB",
    building: "Lecture Theatres",
    openingHours: "Mon-Sat 7:00-19:00",
  },
  {
    key: "marketing_dept",
    name: "Marketing Department",
    category: "department",
    description: "Department of Marketing and Management.",
    x: 60,
    y: -125,
    shortCode: "MKT",
    building: "Business School",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "masscomm_dept",
    name: "Mass Communication Department",
    category: "department",
    description: "Department of Mass Communication.",
    x: -135,
    y: -35,
    shortCode: "MAC",
    building: "Arts Block",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "bus_admin",
    name: "Business Administration Department",
    category: "department",
    description: "Department of Business Administration.",
    x: 255,
    y: -35,
    shortCode: "BUS",
    building: "Business School",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "hostel_a",
    name: "Hostel A (Male)",
    category: "hostel",
    description: "Male student hostel, zone A.",
    x: -300,
    y: -135,
    shortCode: "H-A",
    building: "Hostel A",
  },
  {
    key: "hostel_b",
    name: "Hostel B (Male)",
    category: "hostel",
    description: "Male student hostel, zone B.",
    x: -355,
    y: -25,
    shortCode: "H-B",
    building: "Hostel B",
  },
  {
    key: "hostel_c",
    name: "Hostel C (Female)",
    category: "hostel",
    description: "Female student hostel, zone C.",
    x: 300,
    y: -140,
    shortCode: "H-C",
    building: "Hostel C",
  },
  {
    key: "hostel_d",
    name: "Hostel D (Female)",
    category: "hostel",
    description: "Female student hostel, zone D.",
    x: 355,
    y: -20,
    shortCode: "H-D",
    building: "Hostel D",
  },
  {
    key: "cafeteria",
    name: "Student Cafeteria",
    category: "cafeteria",
    description: "Main student cafeteria and food court.",
    x: -55,
    y: 65,
    shortCode: "CAF",
    openingHours: "Daily 7:00-22:00",
  },
  {
    key: "sports_complex",
    name: "Sports Complex",
    category: "sports",
    description: "Football pitch, courts and gymnasium.",
    x: 335,
    y: 195,
    shortCode: "SPT",
    openingHours: "Daily 6:00-19:00",
  },
  {
    key: "mosque",
    name: "Campus Mosque",
    category: "worship",
    description: "Muslim prayer ground and mosque.",
    x: -40,
    y: 225,
    shortCode: "MSQ",
    openingHours: "Open daily",
  },
  {
    key: "chapel",
    name: "Campus Chapel",
    category: "worship",
    description: "Christian worship centre.",
    x: 140,
    y: 235,
    shortCode: "CHP",
    openingHours: "Open daily",
  },
  {
    key: "clinic",
    name: "Health Centre (Clinic)",
    category: "health",
    description: "Campus clinic and medical services.",
    x: -175,
    y: -225,
    shortCode: "CLN",
    openingHours: "Mon-Fri 8:00-17:00",
  },
  {
    key: "car_park",
    name: "Main Car Park",
    category: "landmark",
    description: "Visitor and staff parking area near the main gate.",
    x: 110,
    y: -250,
    shortCode: "PRK",
    openingHours: "Daily 6:00-22:00",
  },
];

/**
 * Connections. Keys may be junction keys (`j1`) or place keys (`library`).
 * Distance is always computed from the coordinates with the Haversine formula.
 */
export const edges: SeedEdge[] = [
  // --- main road network (junction ring and spokes) ---
  { from: "j1", to: "j2", pathType: "road" },
  { from: "j1", to: "j3", pathType: "road" },
  { from: "j1", to: "j4", pathType: "road" },
  { from: "j1", to: "j5", pathType: "road" },
  { from: "j2", to: "j6", pathType: "road" },
  { from: "j3", to: "j7", pathType: "road" },
  { from: "j2", to: "j8", pathType: "road" },
  { from: "j3", to: "j9", pathType: "road" },
  { from: "j4", to: "j6", pathType: "road" },
  { from: "j4", to: "j7", pathType: "road" },
  { from: "j5", to: "j8", pathType: "road" },
  { from: "j5", to: "j9", pathType: "road" },
  { from: "j6", to: "j10", pathType: "road" },
  { from: "j7", to: "j11", pathType: "road" },
  { from: "j8", to: "j10", pathType: "road" },
  { from: "j9", to: "j11", pathType: "road" },
  { from: "j4", to: "j12", pathType: "road" },
  { from: "j12", to: "j7", pathType: "road" },
  { from: "j5", to: "j13", pathType: "road" },
  { from: "j13", to: "j8", pathType: "road" },
  { from: "j5", to: "j14", pathType: "road" },
  { from: "j14", to: "j9", pathType: "road" },
  // diagonal shortcut across the quadrangle
  { from: "j1", to: "j6", pathType: "shortcut" },
  { from: "j1", to: "j9", pathType: "footpath" },

  // --- south gate approach ---
  { from: "main_gate", to: "j13", pathType: "road" },
  { from: "main_gate", to: "j14", pathType: "footpath" },
  { from: "car_park", to: "j14", pathType: "road" },
  { from: "car_park", to: "j5", pathType: "footpath" },

  // --- administrative core ---
  { from: "senate", to: "j5", pathType: "road" },
  { from: "senate", to: "j1", pathType: "footpath" },
  { from: "admin_block", to: "j2", pathType: "road" },
  { from: "admin_block", to: "j1", pathType: "footpath" },
  { from: "bursary", to: "j5", pathType: "footpath" },
  { from: "bursary", to: "j8", pathType: "road" },
  { from: "masscomm_dept", to: "j2", pathType: "road" },
  { from: "masscomm_dept", to: "admin_block", pathType: "footpath" },

  // --- science and business side ---
  { from: "marketing_dept", to: "j5", pathType: "footpath" },
  { from: "marketing_dept", to: "senate", pathType: "footpath" },
  { from: "lab_science", to: "j3", pathType: "road" },
  { from: "lab_science", to: "marketing_dept", pathType: "footpath" },
  { from: "lab_physics", to: "j9", pathType: "road" },
  { from: "lab_physics", to: "j3", pathType: "footpath" },
  { from: "bus_admin", to: "j3", pathType: "road" },
  { from: "bus_admin", to: "lab_physics", pathType: "footpath" },
  { from: "cs_dept", to: "j7", pathType: "road" },
  { from: "cs_dept", to: "j3", pathType: "road" },
  { from: "lab_cs", to: "j7", pathType: "footpath" },
  { from: "lab_cs", to: "cs_dept", pathType: "shortcut" },
  { from: "ict_centre", to: "j7", pathType: "road" },
  { from: "ict_centre", to: "j4", pathType: "footpath" },

  // --- library (stairs to the upper terrace) ---
  { from: "library", to: "j1", pathType: "road" },
  { from: "library", to: "j4", pathType: "stairs" },

  // --- lecture theatres and cafeteria ---
  { from: "lt_a", to: "j6", pathType: "road" },
  { from: "lt_a", to: "j2", pathType: "footpath" },
  { from: "lt_b", to: "j6", pathType: "road" },
  { from: "lt_b", to: "lt_a", pathType: "footpath" },
  { from: "cafeteria", to: "j1", pathType: "footpath" },
  { from: "cafeteria", to: "lt_a", pathType: "footpath" },

  // --- hostels and workshop ---
  { from: "hostel_a", to: "j8", pathType: "road" },
  { from: "hostel_a", to: "hostel_b", pathType: "footpath" },
  { from: "hostel_b", to: "j10", pathType: "road" },
  { from: "workshop", to: "hostel_b", pathType: "footpath" },
  { from: "j10", to: "workshop", pathType: "road", isBidirectional: false },
  { from: "hostel_c", to: "j9", pathType: "road" },
  { from: "hostel_c", to: "bus_admin", pathType: "footpath" },
  { from: "hostel_d", to: "j11", pathType: "road" },
  { from: "hostel_d", to: "hostel_c", pathType: "footpath" },

  // --- sport, worship, clinic ---
  { from: "sports_complex", to: "j11", pathType: "road" },
  { from: "sports_complex", to: "j7", pathType: "road" },
  { from: "mosque", to: "j4", pathType: "footpath" },
  { from: "mosque", to: "j12", pathType: "footpath" },
  { from: "chapel", to: "j12", pathType: "stairs" },
  { from: "chapel", to: "j7", pathType: "road" },
  { from: "clinic", to: "j8", pathType: "road" },
  { from: "clinic", to: "j13", pathType: "footpath" },
];
