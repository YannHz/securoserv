import express from 'express'
import sql from 'mssql'
import { getDatabase } from './database.ts'
import { authenticate,createUser,requireSession,requireAdmin,startSession,clearSession } from './auth.ts'
export const app = express()
app.disable('x-powered-by')
app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');next()})
app.use('/api',(req,res,next)=>{
  if(['POST','PUT','DELETE','PATCH'].includes(req.method) && req.get('X-SecuroServ-Request')!=='1'){res.status(403).json({message:'Solicitud no permitida.'});return}
  next()
})
app.use(express.json({limit:'8kb'}))
app.get('/api/health',(_req,res)=>{res.json({status:'ok'})})
app.get('/api/health/database',async(_req,res)=>{try{const db=await getDatabase();await db.request().query('SELECT 1 AS connected');res.json({status:'ok',database:'connected'})}catch{res.status(503).json({status:'error',database:'unavailable'})}})
app.post('/api/auth/login',async(req,res)=>{
  const username=typeof req.body?.username==='string'?req.body.username.trim().toLowerCase():''
  if(!username || username.length>40){res.status(400).json({message:'Escribe un usuario de hasta 40 caracteres.'});return}
  const result=await authenticate(username,req.body?.pin)
  if(result.status===200 && result.body.user)startSession(req,res,result.body.user.id)
  res.status(result.status).json(result.body)
})
app.get('/api/auth/me',requireSession,(_req,res)=>{res.json({user:res.locals.user})})
app.post('/api/auth/logout',(req,res)=>{clearSession(req,res);res.json({message:'Sesión cerrada.'})})
app.post('/api/users',requireSession,requireAdmin,async(req,res)=>{const result=await createUser(req.body??{});res.status(result.status).json(result.body)})
app.get('/api/audits',requireSession,requireAdmin,async(req,res)=>{
  const page=Math.max(1,Math.min(1000000,Number(req.query.page)||1))
  if(!Number.isInteger(page)){res.status(400).json({message:'Página no válida.'});return}
  const result=typeof req.query.result==='string'?req.query.result:'TODOS'
  if(!['TODOS','CORRECTO','ERROR'].includes(result)){res.status(400).json({message:'Resultado no válido.'});return}
  const search=typeof req.query.search==='string'?req.query.search.slice(0,100):''
  const db=await getDatabase()
  const rows=await db.request().input('result',sql.VarChar(8),result).input('search',sql.NVarChar(100),search).input('offset',sql.Int,(page-1)*50).query(`
    SELECT COUNT_BIG(*) AS total FROM dbo.auditoria WHERE (@result='TODOS' OR resultado=@result) AND (@search=N'' OR CHARINDEX(@search,usuario)>0 OR CHARINDEX(@search,detalle)>0);
    SELECT CONVERT(VARCHAR(20),id) AS id,usuario AS username,fecha AS at,resultado AS result,detalle AS detail FROM dbo.auditoria WHERE (@result='TODOS' OR resultado=@result) AND (@search=N'' OR CHARINDEX(@search,usuario)>0 OR CHARINDEX(@search,detalle)>0) ORDER BY fecha DESC,id DESC OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY;
  `)
  const sets=rows.recordsets as unknown as [Array<{total:number}>,unknown[]]
  res.json({items:sets[1],total:Number(sets[0][0].total),page,pageSize:50})
})
app.use((_req,res)=>{res.status(404).json({message:'Ruta no encontrada.'})})
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const status=(error as {status?:number})?.status
  if(status===400 || status===413){res.status(status).json({message:status===413?'Solicitud demasiado grande.':'Solicitud no válida.'});return}
  console.error('No se pudo completar una operación del backend.')
  res.status(503).json({message:'No se pudo completar la operación. Comprueba la conexión con la base de datos e inténtalo nuevamente.'})
})
