import { getDatabase, closeDatabase, connectionError } from "./database.ts";
try {
  const db = await getDatabase();
  const result = await db.request().query(`
    SELECT DB_NAME() AS base_de_datos,
      CASE WHEN OBJECT_ID(N'dbo.usuarios', N'U') IS NOT NULL THEN 1 ELSE 0 END AS tabla_usuarios,
      CASE WHEN OBJECT_ID(N'dbo.auditoria', N'U') IS NOT NULL THEN 1 ELSE 0 END AS tabla_auditoria;
  `);
  const status = result.recordset[0];
  console.log("Conexión cifrada con Azure SQL: correcta.");
  console.log(`Base de datos: ${status.base_de_datos}`);
  console.log(
    `Tabla usuarios: ${status.tabla_usuarios ? "OK" : "NO ENCONTRADA"}`,
  );
  console.log(
    `Tabla auditoria: ${status.tabla_auditoria ? "OK" : "NO ENCONTRADA"}`,
  );
  if (!status.tabla_usuarios || !status.tabla_auditoria) process.exitCode = 1;
} catch (error) {
  console.error(connectionError(error));
  process.exitCode = 1;
} finally {
  await closeDatabase().catch(() => undefined);
}
