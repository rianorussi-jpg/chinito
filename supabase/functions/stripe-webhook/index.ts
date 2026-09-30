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

const stripeKey=Deno.env.get('STRIPE_RESTRICTED_KEY')||''
const webhookSecret=Deno.env.get('STRIPE_WEBHOOK_SECRET')||''
const supabaseUrl=Deno.env.get('SUPABASE_URL')||''
const serviceKey=envApiKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS')||''
const stripe=new Stripe(stripeKey)
const cryptoProvider=Stripe.createSubtleCryptoProvider()
const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})

const markPaid=async(session:Stripe.Checkout.Session)=>{
  const orderId=session.metadata?.order_id
  if(!orderId)return
  const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:null
  await admin.from('orders').update({
    payment_status:'paid',
    stripe_checkout_session_id:session.id,
    stripe_payment_intent_id:paymentIntentId,
    stripe_paid_at:new Date().toISOString(),
  }).eq('id',orderId).neq('status','Cancelado')
}

const cancelUnpaid=async(session:Stripe.Checkout.Session)=>{
  const orderId=session.metadata?.order_id
  if(!orderId)return
  await admin.from('orders').update({payment_status:'failed',status:'Cancelado'})
    .eq('id',orderId).neq('payment_status','paid')
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  if(!stripeKey||!webhookSecret||!supabaseUrl||!serviceKey)return new Response('Webhook server is not configured',{status:500})

  const signature=req.headers.get('stripe-signature')||''
  const rawBody=await req.text()
  let event:Stripe.Event
  try{
    event=await stripe.webhooks.constructEventAsync(rawBody,signature,webhookSecret,undefined,cryptoProvider)
  }catch(err){
    return new Response(`Invalid signature: ${err instanceof Error?err.message:'unknown error'}`,{status:400})
  }

  try{
    switch(event.type){
      case 'checkout.session.completed':{
        const session=event.data.object as Stripe.Checkout.Session
        if(session.payment_status==='paid')await markPaid(session)
        break
      }
      case 'checkout.session.async_payment_succeeded':
        await markPaid(event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        await cancelUnpaid(event.data.object as Stripe.Checkout.Session)
        break
      case 'charge.refunded':{
        const charge=event.data.object as Stripe.Charge
        const paymentIntentId=typeof charge.payment_intent==='string'?charge.payment_intent:null
        const fullyRefunded=charge.refunded===true||Number(charge.amount_refunded||0)>=Number(charge.amount||0)
        if(paymentIntentId&&fullyRefunded){
          // Solo un reembolso total cancela el pedido y revierte/deuelve el cashback correspondiente.
          await admin.from('orders').update({payment_status:'refunded',status:'Cancelado'})
            .eq('stripe_payment_intent_id',paymentIntentId)
        }
        break
      }
      default:
        break
    }
  }catch(err){
    console.error('Stripe webhook processing error',err)
    return new Response('Webhook processing failed',{status:500})
  }

  return Response.json({received:true})
})
