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
    const {session_id:sessionId}=await req.json()
    if(typeof sessionId!=='string'||!sessionId.startsWith('cs_'))return json({error:'Sesión de Stripe inválida.'},400)

    const stripe=new Stripe(stripeKey)
    const session=await stripe.checkout.sessions.retrieve(sessionId)
    const orderId=session.metadata?.order_id
    if(!orderId||session.metadata?.user_id!==user.id)return json({error:'Este pago no pertenece a tu cuenta.'},403)

    if(session.payment_status==='paid'){
      const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:null
      const {error}=await admin.from('orders').update({
        payment_status:'paid',
        stripe_checkout_session_id:session.id,
        stripe_payment_intent_id:paymentIntentId,
        stripe_paid_at:new Date().toISOString(),
      }).eq('id',orderId).eq('customer_id',user.id).neq('status','Cancelado')
      if(error)throw error
      return json({paid:true,order_id:orderId,payment_status:'paid'})
    }

    if(session.status==='expired'){
      await admin.from('orders').update({payment_status:'failed',status:'Cancelado'})
        .eq('id',orderId).eq('customer_id',user.id).neq('payment_status','paid')
      return json({paid:false,order_id:orderId,payment_status:'failed',message:'La sesión de pago expiró.'})
    }

    return json({paid:false,order_id:orderId,payment_status:session.payment_status,message:'El pago todavía no aparece como completado.'})
  }catch(err){
    return json({error:err instanceof Error?err.message:'No pudimos verificar el pago.'},400)
  }
})
