import { z } from "zod";
import { locationCategoryEnum, roleEnum, themeEnum } from "@/db/schema";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const emailSchema = z
  .email("Enter a valid email address")
  .max(255)
  .transform((v) => v.toLowerCase().trim());

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(120, "Name is too long"),
  email: emailSchema,
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    )
    .max(128, "Password is too long"),
  role: z
    .enum(["student", "staff", "visitor"])
    .default("student"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ */
/* Locations & search                                                  */
/* ------------------------------------------------------------------ */

export const categorySchema = z.enum(locationCategoryEnum.enumValues);

export const locationInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
  category: categorySchema,
  description: z.string().trim().max(600).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  shortCode: z.string().trim().max(16).optional().nullable(),
  building: z.string().trim().max(120).optional().nullable(),
  floorInfo: z.string().trim().max(60).optional().nullable(),
  openingHours: z.string().trim().max(120).optional().nullable(),
  isEntrance: z.boolean().optional(),
  photoUrl: z.string().url().max(400).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  category: categorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const locationsQuerySchema = z.object({
  category: categorySchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
  /** Comma separated ids - used to resolve shared links and favourites. */
  ids: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export const routePointSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("location"), id: z.number().int().positive() }),
  z.object({
    type: z.literal("gps"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
]);

export const routeRequestSchema = z
  .object({
    from: routePointSchema,
    to: routePointSchema,
    avoidStairs: z.boolean().optional(),
    walkingSpeedMps: z.number().min(0.5).max(2.5).optional(),
    recordHistory: z.boolean().optional(),
  })
  .refine((v) => {
    if (v.from.type !== v.to.type) return true;
    if (v.from.type === "location" && v.to.type === "location") {
      return v.from.id !== v.to.id;
    }
    return true;
  }, "Start and destination must be different");

export const nearestQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type RouteRequest = z.infer<typeof routeRequestSchema>;

/* ------------------------------------------------------------------ */
/* User features                                                       */
/* ------------------------------------------------------------------ */

export const favouriteSchema = z.object({
  locationId: z.number().int().positive(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(1000).optional(),
  routeHistoryId: z.number().int().positive().optional(),
});

export const preferencesSchema = z
  .object({
    avoidStairs: z.boolean().optional(),
    walkingSpeedMps: z.number().min(0.5).max(2.5).optional(),
    defaultStartLocationId: z.number().int().positive().nullable().optional(),
    theme: z.enum(themeEnum.enumValues).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

/* ------------------------------------------------------------------ */
/* Admin graph editor                                                  */
/* ------------------------------------------------------------------ */

export const adminNodeSchema = z.object({
  id: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationId: z.number().int().positive().nullable().optional(),
  label: z.string().trim().max(120).optional().nullable(),
});

export const adminEdgeSchema = z.object({
  id: z.number().int().positive().optional(),
  fromNode: z.number().int().positive(),
  toNode: z.number().int().positive(),
  distanceM: z.number().positive().optional(),
  pathType: z
    .enum(["road", "footpath", "stairs", "shortcut"])
    .default("footpath"),
  isBidirectional: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(roleEnum.enumValues),
});
