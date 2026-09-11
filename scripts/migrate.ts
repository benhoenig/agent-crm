import "dotenv/config";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDb } from "../lib/db";

// Applies ./drizzle migrations over the Neon HTTP driver — drizzle-kit's own
// websocket driver fails silently under Node 22, and this keeps migrations on
// the exact driver the app uses.
migrate(getDb(), { migrationsFolder: "./drizzle" }).then(() => {
  console.log("migrations applied");
  process.exit(0);
});
