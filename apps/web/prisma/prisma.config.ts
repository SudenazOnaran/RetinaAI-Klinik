import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI defaults to .env, while this project keeps DB vars in .env.local.
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL tanimli degil. Prisma config yuklenemedi.");
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
