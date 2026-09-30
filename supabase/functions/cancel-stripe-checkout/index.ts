import Stripe from 'npm:stripe@^22.0.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const envApiKey=(legacy:string,plural:string)=>{
  const direct=Deno.env.get(legacy)
  if(direct)return direct
  const raw=Deno.env.get(plural)
  if(!raw)return ''
  try{
    const parsed=JSON.parse(raw)
    return parsed?.default||Object.values(parsed||{})[0]||''
  }catch{return ''}
}

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Método no permitido.'},405)

  const stripeKey=Deno.env.get('STRIPE_RESTRICTED_KEY')
  const supabaseUrl=Deno.env.get('SUPABASE_URL')
  const anonKey=envApiKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS')
  const serviceKey=envApiKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS')
  if(!stripeKey||!supabaseUrl||!anonKey||!serviceKey)return json({error:'Faltan secretos del servidor.'},500)

  const authorization=req.headers.get('Authorization')||''
  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}})
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json({error:'Tu sesión expiró.'},401)

  try{
    const {order_id:orderId}=await req.json()
    if(typeof orderId!=='string'||!orderId)return json({error:'Pedido inválido.'},400)
    const {data:order,error}=await admin.from('orders')
      .select('id,customer_id,payment_status,status,stripe_checkout_session_id')
      .eq('id',orderId).maybeSingle()
    if(error)throw error
    if(!order||order.customer_id!==user.id)return json({error:'Pedido no encontrado.'},404)
    if(order.payment_status==='paid')return json({error:'El pedido ya está pagado y no se puede cancelar desde esta pantalla.'},409)

    const stripe=new Stripe(stripeKey)
    if(order.stripe_checkout_session_id){
      try{
        await stripe.checkout.sessions.expire(order.stripe_checkout_session_id)
      }catch{
        const session=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id)
        if(session.payment_status==='paid'){
          const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:null
          await admin.from('orders').update({payment_status:'paid',stripe_payment_intent_id:paymentIntentId,stripe_paid_at:new Date().toISOString()})
            .eq('id',order.id)
          return json({cancelled:false,paid:true,order_id:order.id})
        }
      }
    }

    const {error:cancelError}=await admin.from('orders').update({payment_status:'failed',status:'Cancelado'})
      .eq('id',order.id).neq('payment_status','paid')
    if(cancelError)throw cancelError
    return json({cancelled:true,order_id:order.id})
  }catch(err){
    return json({error:err instanceof Error?err.message:'No pudimos cancelar el pago.'},400)
  }
})
