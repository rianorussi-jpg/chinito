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
  const appUrl=(Deno.env.get('CLIENT_APP_URL')||'').replace(/\/$/,'')
  const supabaseUrl=Deno.env.get('SUPABASE_URL')
  const anonKey=envApiKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS')
  const serviceKey=envApiKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS')
  if(!stripeKey||!appUrl||!supabaseUrl||!anonKey||!serviceKey)return json({error:'Faltan secretos del servidor para Stripe.'},500)

  const authorization=req.headers.get('Authorization')||''
  if(!authorization)return json({error:'Inicia sesión para pagar.'},401)

  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}})
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})
  const {data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)return json({error:'Tu sesión expiró. Vuelve a iniciar sesión.'},401)

  const {data:settings,error:settingsError}=await admin.from('store_settings')
    .select('store_open,pickup_enabled').eq('id',1).maybeSingle()
  if(settingsError)return json({error:'No pudimos validar si la tienda está abierta.'},500)
  if(settings&&(!settings.store_open||!settings.pickup_enabled))return json({error:'La tienda no está recibiendo pedidos en este momento.'},409)

  let createdOrderId:string|null=null
  try{
    const body=await req.json()
    const pickupLabel=String(body?.pickup_label||'').trim()
    const items=body?.items
    const cashbackToUse=Number(body?.cashback_to_use||0)
    if(!Array.isArray(items)||items.length===0)return json({error:'El carrito está vacío.'},400)
    if(!Number.isFinite(cashbackToUse)||cashbackToUse<0)return json({error:'Cashback inválido.'},400)

    // Esta RPC vuelve a calcular precios y disponibilidad usando el catálogo de Supabase.
    const {data:rpcData,error:rpcError}=await userClient.rpc('create_customer_order_with_cashback',{
      p_pickup_label:pickupLabel,
      p_payment_method:'online',
      p_items:items,
      p_cashback_to_use:cashbackToUse,
    })
    if(rpcError)throw new Error(rpcError.message)
    const created=Array.isArray(rpcData)?rpcData[0]:rpcData
    if(!created?.order_id)throw new Error('No se pudo crear el pedido para cobrarlo.')
    createdOrderId=created.order_id

    const total=Number(created.total||0)
    if(!Number.isFinite(total)||total<0)throw new Error('Total de pedido inválido.')

    // Si el cashback cubre el 100%, no se crea un cobro de $0 en Stripe.
    if(total>0&&total<10){
      throw new Error('Stripe requiere un cobro mínimo de $10 MXN. Reduce el cashback aplicado o úsalo para cubrir el total completo.')
    }

    if(total===0){
      const {error:updateError}=await admin.from('orders').update({
        payment_status:'paid',
        stripe_paid_at:new Date().toISOString(),
      }).eq('id',createdOrderId).eq('customer_id',user.id)
      if(updateError)throw new Error(updateError.message)
      return json({paid:true,order_id:createdOrderId,order_number:created.order_number,total:0})
    }

    const stripe=new Stripe(stripeKey)
    const amount=Math.round(total*100)
    const session=await stripe.checkout.sessions.create({
      mode:'payment',
      payment_method_types:['card'],
      client_reference_id:createdOrderId,
      customer_email:user.email||undefined,
      line_items:[{
        quantity:1,
        price_data:{
          currency:'mxn',
          unit_amount:amount,
          product_data:{
            name:`Pedido ${created.order_number}`,
            description:'Chi-nito · Pedido para recoger',
          },
        },
      }],
      metadata:{order_id:createdOrderId,user_id:user.id},
      payment_intent_data:{
        description:`Chi-nito ${created.order_number}`,
        metadata:{order_id:createdOrderId,user_id:user.id},
      },
      success_url:`${appUrl}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${appUrl}/?stripe=cancel&order_id=${encodeURIComponent(createdOrderId)}`,
      expires_at:Math.floor(Date.now()/1000)+(30*60),
      locale:'es',
      submit_type:'pay',
    })

    if(!session.url)throw new Error('Stripe no devolvió la URL de pago.')
    const {error:saveError}=await admin.from('orders').update({stripe_checkout_session_id:session.id})
      .eq('id',createdOrderId).eq('customer_id',user.id)
    if(saveError){
      try{await stripe.checkout.sessions.expire(session.id)}catch{/* noop */}
      throw new Error(saveError.message)
    }

    return json({
      paid:false,
      url:session.url,
      session_id:session.id,
      order_id:createdOrderId,
      order_number:created.order_number,
      total,
    })
  }catch(err){
    if(createdOrderId){
      // Cancelar el pedido devuelve automáticamente el cashback reservado por la migración existente.
      await admin.from('orders').update({payment_status:'failed',status:'Cancelado'})
        .eq('id',createdOrderId).neq('payment_status','paid')
    }
    return json({error:err instanceof Error?err.message:'No pudimos iniciar el pago con Stripe.'},400)
  }
})
