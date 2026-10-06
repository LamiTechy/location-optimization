CREATE TYPE "public"."location_category" AS ENUM('department', 'hostel', 'office', 'lecture_hall', 'laboratory', 'library', 'gate', 'landmark', 'cafeteria', 'sports', 'worship', 'health', 'other');--> statement-breakpoint
CREATE TYPE "public"."path_type" AS ENUM('road', 'footpath', 'stairs', 'shortcut');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'staff', 'visitor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_node" integer NOT NULL,
	"to_node" integer NOT NULL,
	"distance_m" double precision,
	"path_type" "path_type" DEFAULT 'road' NOT NULL,
	"is_bidirectional" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"geometry" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edges_distance_positive" CHECK ("edges"."distance_m" is null or "edges"."distance_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_user_id_location_id_pk" PRIMARY KEY("user_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"message" text,
	"route_history_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "graph_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "location_category" NOT NULL,
	"description" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"short_code" varchar(16),
	"building" varchar(120),
	"floor_info" varchar(60),
	"opening_hours" varchar(120),
	"is_entrance" boolean DEFAULT false NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location_id" integer,
	"label" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"avoid_stairs" boolean DEFAULT false NOT NULL,
	"walking_speed_mps" double precision DEFAULT 1.4 NOT NULL,
	"default_start_location_id" integer,
	"theme" "user_theme" DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"from_location_id" integer,
	"from_lat" double precision,
	"from_lng" double precision,
	"to_location_id" integer,
	"distance_m" double precision NOT NULL,
	"duration_min" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_from_node_nodes_id_fk" FOREIGN KEY ("from_node") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_to_node_nodes_id_fk" FOREIGN KEY ("to_node") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_route_history_id_route_history_id_fk" FOREIGN KEY ("route_history_id") REFERENCES "public"."route_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_default_start_location_id_locations_id_fk" FOREIGN KEY ("default_start_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_history" ADD CONSTRAINT "route_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_history" ADD CONSTRAINT "route_history_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_history" ADD CONSTRAINT "route_history_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edges_from_idx" ON "edges" USING btree ("from_node");--> statement-breakpoint
CREATE INDEX "edges_to_idx" ON "edges" USING btree ("to_node");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "locations_category_idx" ON "locations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "locations_name_idx" ON "locations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "locations_search_text_idx" ON "locations" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "nodes_location_idx" ON "nodes" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "route_history_user_idx" ON "route_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");