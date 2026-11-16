import { app } from "./app.ts";
import { serverPort } from "./config.ts";
import { closeDatabase } from "./database.ts";
const server = app.listen(serverPort(), "127.0.0.1", () => {
  console.log(`Backend local: http://127.0.0.1:${serverPort()}`);
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    void closeDatabase()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
