import sql from 'mssql'
import type { Request, Response, NextFunction } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { getDatabase } from './database.ts'
import { hashPin, verifyPin, validPin } from './pin.ts'
export type PublicUser = { id: number; username: string; name: string; role: string }
type Row = { id: number; usuario: string; nombre: string; rol: string; activo: boolean; pin_hash: string; intentos_fallidos: number; bloqueado_hasta: Date | null }
export const publicUser = (u: Row): PublicUser => ({id:u.id,username:u.usuario,name:u.nombre,role:u.rol})
const sessions = new Map<string,{userId:number;expires:number}>()
const cookieName = 'securoserv_session'
const digest = (s:string) => createHash('sha256').update(s).digest('hex')
function token(request:Request) { return request.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1) || '' }
const cookieOptions = {httpOnly:true,sameSite:'strict' as const,secure:false,path:'/'}
export function clearSession(request:Request,response:Response) { sessions.delete(digest(token(request)));response.clearCookie(cookieName,cookieOptions) }
export function startSession(request:Request,response:Response,userId:number) {
  sessions.delete(digest(token(request)))
  const raw = randomBytes(32).toString('hex')
  sessions.set(digest(raw),{userId,expires:Date.now()+8*60*60*1000})
  response.cookie(cookieName,raw,{...cookieOptions,maxAge:8*60*60*1000})
}
const cleanup = setInterval(()=>{ for(const [key,s] of sessions) if(s.expires<=Date.now()) sessions.delete(key) },60000)
cleanup.unref()
export async function requireSession(request:Request,response:Response,next:NextFunction) {
  const stored = sessions.get(digest(token(request)))
  if(!stored || stored.expires<=Date.now()) { clearSession(request,response);response.status(401).json({message:'Inicia sesión para continuar.'});return }
  try {
    const db = await getDatabase()
    const result = await db.request().input('id',sql.Int,stored.userId).query<Row>('SELECT id,usuario,nombre,rol,activo FROM dbo.usuarios WHERE id=@id')
    const user = result.recordset[0]
    if(!user?.activo){clearSession(request,response);response.status(401).json({message:'Tu sesión ya no está disponible.'});return}
    response.locals.user = publicUser(user)
    next()
  }catch(error){next(error)}
}
export function requireAdmin(_request:Request,response:Response,next:NextFunction) {
  if(response.locals.user?.role!=='Administrador'){response.status(403).json({message:'Solo el administrador puede realizar esta acción.'});return}next()
}
export async function authenticate(username:string,pin:unknown) {
  const db = await getDatabase()
  const tx = new sql.Transaction(db)
  await tx.begin()
  try {
    const result = await new sql.Request(tx).input('username',sql.NVarChar(40),username).query<Row & {server_now:Date}>(`SELECT *,SYSUTCDATETIME() AS server_now FROM dbo.usuarios WITH (UPDLOCK,HOLDLOCK) WHERE usuario=@username`)
    const row = result.recordset[0]
    let detail = '', message = 'Usuario o PIN incorrecto.', status = 401, lockedUntil: string | undefined, attemptsRemaining: number | undefined
    if(!row) detail = 'Usuario inexistente'
    else if(!row.activo) detail = 'Cuenta inactiva'
    else if(row.bloqueado_hasta && row.bloqueado_hasta>row.server_now) {detail='Cuenta bloqueada';message='Cuenta bloqueada temporalmente.';status=423;lockedUntil=row.bloqueado_hasta.toISOString()}
    else if(!validPin(pin)) {detail='Formato de PIN no válido';message='El PIN debe tener 8 dígitos y no empezar con 0.';status=400}
    else if(!await verifyPin(pin,row.pin_hash)) {
      const expired = !!row.bloqueado_hasta && row.bloqueado_hasta<=row.server_now
      const failures = Math.min(3,(expired?0:row.intentos_fallidos)+1)
      const updated = await new sql.Request(tx).input('id',sql.Int,row.id).input('failures',sql.TinyInt,failures).query<{bloqueado_hasta:Date|null}>(`UPDATE dbo.usuarios SET intentos_fallidos=@failures,bloqueado_hasta=CASE WHEN @failures>=3 THEN DATEADD(MINUTE,5,SYSUTCDATETIME()) ELSE NULL END OUTPUT INSERTED.bloqueado_hasta WHERE id=@id`)
      attemptsRemaining=3-failures
      detail=failures===3?'PIN incorrecto; bloqueo de 5 minutos':'PIN incorrecto'
      message=failures===3?'Cuenta bloqueada durante 5 minutos.':`PIN incorrecto. Te quedan ${attemptsRemaining} intentos.`
      if(failures===3){status=423;lockedUntil=updated.recordset[0].bloqueado_hasta!.toISOString()}
    } else {
      await new sql.Request(tx).input('id',sql.Int,row.id).query('UPDATE dbo.usuarios SET intentos_fallidos=0,bloqueado_hasta=NULL WHERE id=@id')
      detail='Inicio de sesión';status=200
    }
    await new sql.Request(tx).input('id',sql.Int,row?.id??null).input('username',sql.NVarChar(40),row?.usuario??'desconocido').input('result',sql.VarChar(8),status===200?'CORRECTO':'ERROR').input('detail',sql.NVarChar(200),detail).query('INSERT INTO dbo.auditoria(usuario_id,usuario,resultado,detalle) VALUES(@id,@username,@result,@detail)')
    await tx.commit()
    return {status,body:status===200?{user:publicUser(row)}:{message,lockedUntil,attemptsRemaining}}
  }catch(error){await tx.rollback().catch(()=>undefined);throw error}
}
export async function createUser(body: Record<string,unknown>) {
  const name = typeof body.name==='string'?body.name.trim():''
  const username = typeof body.username==='string'?body.username.trim().toLowerCase():''
  if(!name || name.length>80 || !/^[a-z0-9._-]{3,40}$/.test(username) || !validPin(body.pin)) return {status:400,body:{message:'Revisa el nombre, usuario y PIN de 8 dígitos sin cero inicial.'}}
  if(body.role==='Administrador') return {status:409,body:{message:'Solo puede existir un administrador.'}}
  if(!['Secretario','Ejecutivo','Oficinista'].includes(String(body.role))) return {status:400,body:{message:'Selecciona un rol válido.'}}
  const hashed = await hashPin(body.pin)
  const db = await getDatabase()
  try {
    await db.request().input('name',sql.NVarChar(80),name).input('username',sql.NVarChar(40),username).input('pin',sql.NVarChar(512),hashed).input('role',sql.NVarChar(20),body.role).query('INSERT INTO dbo.usuarios(nombre,usuario,pin_hash,rol) VALUES(@name,@username,@pin,@role)')
    return {status:201,body:{message:'Usuario registrado correctamente.'}}
  }catch(error){if([2601,2627].includes((error as {number:number}).number))return {status:409,body:{message:'Ese nombre de usuario ya existe.'}};throw error}
}
