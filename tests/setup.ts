import { loadEnvFiles } from "@/lib/load-env";

// Makes DATABASE_URL / JWT_SECRET available to any test that touches the DB.
loadEnvFiles();
