import {
  BookOpen,
  Building2,
  DoorOpen,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  MapPin,
  Presentation,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { LocationCategory } from "@/db/schema";

export interface CategoryMeta {
  label: string;
  /** Short text used for map marker badges. */
  badge: string;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<LocationCategory, CategoryMeta> = {
  department: { label: "Departments", badge: "DEP", icon: GraduationCap },
  hostel: { label: "Hostels", badge: "HST", icon: Building2 },
  office: { label: "Offices", badge: "OFF", icon: Landmark },
  lecture_hall: { label: "Lecture halls", badge: "LEC", icon: Presentation },
  laboratory: { label: "Laboratories", badge: "LAB", icon: FlaskConical },
  library: { label: "Library", badge: "LIB", icon: BookOpen },
  gate: { label: "Gates", badge: "GAT", icon: DoorOpen },
  landmark: { label: "Landmarks", badge: "LND", icon: MapPin },
  cafeteria: { label: "Cafeterias", badge: "CAF", icon: UtensilsCrossed },
  sports: { label: "Sports", badge: "SPT", icon: Dumbbell },
  worship: { label: "Worship", badge: "WOR", icon: Building2 },
  health: { label: "Health", badge: "MED", icon: HeartPulse },
  other: { label: "Other", badge: "MAP", icon: MapPin },
};

export const CATEGORY_ORDER: LocationCategory[] = [
  "gate",
  "department",
  "lecture_hall",
  "library",
  "laboratory",
  "hostel",
  "office",
  "cafeteria",
  "sports",
  "worship",
  "health",
  "landmark",
  "other",
];

export function categoryLabel(category: LocationCategory): string {
  return CATEGORY_META[category]?.label ?? category;
}

export function categoryBadge(category: LocationCategory): string {
  return CATEGORY_META[category]?.badge ?? "MAP";
}
