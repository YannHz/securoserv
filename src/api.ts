export class ApiError extends Error {
  status: number
  lockedUntil?: string
  constructor(message:string,status:number,lockedUntil?:string){super(message);this.status=status;this.lockedUntil=lockedUntil}
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T> {
  let response:Response
  try{response=await fetch(`/api${path}`,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-SecuroServ-Request':'1',...options.headers}})}catch{throw new ApiError('No se pudo conectar con el servidor.',0)}
  const body=await response.json().catch(()=>({message:'El servidor devolvió una respuesta no válida.'}))
  if(!response.ok)throw new ApiError(body.message||'No se pudo completar la solicitud.',response.status,body.lockedUntil)
  return body as T
}
