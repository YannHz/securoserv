// Ejecutar explícitamente: npm run test:integration. Usa Azure SQL configurado.
// Crea una cuenta temporal, verifica sus flujos y elimina solo esa cuenta y sus auditorías.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sql from "mssql";
import { app } from "../server/app.ts";
import { getDatabase, closeDatabase } from "../server/database.ts";
import { hashPin } from "../server/pin.ts";
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api`;
const username = `qa_${randomBytes(6).toString("hex")}`;
let id: number | undefined;
async function request(path: string, body?: unknown, cookie?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SecuroServ-Request": "1",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
try {
  const db = await getDatabase();
  const inserted = await db
    .request()
    .input("username", sql.NVarChar(40), username)
    .input("hash", sql.NVarChar(512), await hashPin("87654321"))
    .query<{ id: number }>(
      "INSERT INTO dbo.usuarios(nombre,usuario,pin_hash,rol) OUTPUT INSERTED.id VALUES(N'Verificación temporal',@username,@hash,N'Oficinista')",
    );
  id = inserted.recordset[0].id;
  assert.equal((await request("/audits")).status, 401);
  const denied = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pin: "87654321" }),
  });
  assert.equal(denied.status, 403);
  const correct = await request("/auth/login", { username, pin: "87654321" });
  assert.equal(correct.status, 200);
  assert.ok(correct.cookie);
  assert.deepEqual(Object.keys(correct.data.user).sort(), [
    "id",
    "name",
    "role",
    "username",
  ]);
  assert.equal(
    (await request("/auth/me", undefined, correct.cookie)).status,
    200,
  );
  assert.equal(
    (await request("/audits", undefined, correct.cookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/users",
        {
          name: "No autorizado",
          username: "not_created",
          pin: "12345678",
          role: "Administrador",
        },
        correct.cookie,
      )
    ).status,
    403,
  );
  assert.equal((await request("/auth/logout", {}, correct.cookie)).status, 200);
  assert.equal(
    (await request("/auth/me", undefined, correct.cookie)).status,
    401,
  );
  const failures = await Promise.all(
    Array.from({ length: 3 }, () =>
      request("/auth/login", { username, pin: "11111111" }),
    ),
  );
  assert.deepEqual(failures.map((r) => r.status).sort(), [401, 401, 423]);
  const blocked = failures.find((r) => r.status === 423)!;
  const retry = await request("/auth/login", { username, pin: "" });
  assert.equal(retry.status, 423);
  assert.equal(retry.data.lockedUntil, blocked.data.lockedUntil);
  const audit = await db
    .request()
    .input("id", sql.Int, id)
    .query<{
      resultado: string;
      detalle: string;
    }>("SELECT resultado,detalle FROM dbo.auditoria WHERE usuario_id=@id ORDER BY id");
  assert.equal(audit.recordset.length, 5);
  assert.equal(audit.recordset[0].resultado, "CORRECTO");
  assert.equal(
    audit.recordset.filter((r) => r.resultado === "ERROR").length,
    4,
  );
  assert.ok(
    audit.recordset.some((r) => r.detalle.includes("bloqueo de 5 minutos")),
  );
  assert.equal(audit.recordset.at(-1)!.detalle, "Cuenta bloqueada");
  // Simula el vencimiento sin esperar cinco minutos.
  await db
    .request()
    .input("id", sql.Int, id)
    .query(
      "UPDATE dbo.usuarios SET bloqueado_hasta=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE id=@id",
    );
  const recovered = await request("/auth/login", { username, pin: "87654321" });
  assert.equal(recovered.status, 200);
  const reset = await db
    .request()
    .input("id", sql.Int, id)
    .query(
      "SELECT intentos_fallidos,bloqueado_hasta FROM dbo.usuarios WHERE id=@id",
    );
  assert.equal(reset.recordset[0].intentos_fallidos, 0);
  assert.equal(reset.recordset[0].bloqueado_hasta, null);
  await request("/auth/logout", {}, recovered.cookie);
  console.log(
    "OK: sesión, cookies, permisos, tres errores concurrentes, bloqueo, auditoría y recuperación.",
  );
} finally {
  if (id) {
    const db = await getDatabase();
    await db
      .request()
      .input("id", sql.Int, id)
      .query(
        "SET XACT_ABORT ON; BEGIN TRANSACTION; DELETE FROM dbo.auditoria WHERE usuario_id=@id; DELETE FROM dbo.usuarios WHERE id=@id; COMMIT TRANSACTION;",
      );
    console.log("Cuenta temporal y sus auditorías eliminadas.");
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDatabase();
}
