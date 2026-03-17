import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "@prisma/internals";

// Prisma CLI defaults to .env, while this project keeps DB vars in .env.local.
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    db: {
      provider: "postgresql",
      url: process.env.DATABASE_URL,
    },
  },
});
