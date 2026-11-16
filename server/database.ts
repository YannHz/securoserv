import sql from "mssql";
import { databaseConfig } from "./config.ts";
let pending: Promise<sql.ConnectionPool> | undefined;
export async function getDatabase() {
  if (!pending) {
    const pool = new sql.ConnectionPool(databaseConfig());
    pool.on("error", () => {
      console.error("Se perdió una conexión del pool SQL.");
    });
    pending = pool.connect().catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
export async function closeDatabase() {
  const connection = pending;
  pending = undefined;
  if (connection) await (await connection).close();
}
export function connectionError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Faltan variables"))
    return error.message;
  const code = (error as { code?: string })?.code;
  if (code === "ELOGIN")
    return "Azure rechazó el acceso. Revisa usuario SQL, contraseña y permisos para securoservdb.";
  if (code === "ETIMEOUT" || code === "ESOCKET")
    return "No se pudo completar la conexión. Revisa internet, DNS, firewall de Azure y la salida TCP 1433 desde el equipo del backend.";
  return "No se pudo verificar Azure SQL. Revisa la configuración y el acceso del usuario a la base de datos.";
}
