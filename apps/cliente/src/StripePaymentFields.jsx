import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const publishableKey=import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY||''
const stripePromise=publishableKey?loadStripe(publishableKey):Promise.resolve(null)

export default function StripePaymentFields({clientSecret,onReady,onError}){
  const mountRef=useRef(null)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!clientSecret)return
    let active=true
    let paymentElement=null
    let checkout=null

    const init=async()=>{
      setLoading(true)
      try{
        if(!publishableKey)throw new Error('Falta VITE_STRIPE_PUBLISHABLE_KEY en Vercel.')
        const stripe=await stripePromise
        if(!stripe)throw new Error('No pudimos cargar Stripe.js.')
        if(!active||!mountRef.current)return

        checkout=stripe.initCheckoutElementsSdk({clientSecret})
        paymentElement=checkout.createPaymentElement({
          layout:{type:'tabs',defaultCollapsed:false},
        })
        paymentElement.mount(mountRef.current)

        const loadResult=await checkout.loadActions()
        if(!active)return
        if(!loadResult?.actions)throw new Error(loadResult?.error?.message||'No pudimos preparar el formulario de pago.')

        onReady?.(async()=>{
          const result=await loadResult.actions.confirm()
          if(result?.error)return result.error
          if(result?.type==='error')return result
          if(result?.message)return result
          return null
        })
      }catch(err){
        if(active)onError?.(err instanceof Error?err.message:'No pudimos cargar el formulario de Stripe.')
      }finally{
        if(active)setLoading(false)
      }
    }

    init()
    return ()=>{
      active=false
      onReady?.(null)
      try{paymentElement?.destroy?.()}catch{/* noop */}
      try{checkout?.destroy?.()}catch{/* noop */}
    }
  },[clientSecret,onReady,onError])

  return <div className="stripe-elements-shell">
    {loading&&<div className="stripe-elements-loading"><span className="stripe-return-spinner"/><span>Preparando pago seguro…</span></div>}
    <div ref={mountRef} className="stripe-payment-element" />
    <div className="stripe-secure-note"><span>🔒</span><span>Los datos de tu tarjeta se envían directamente a Stripe y no pasan por los servidores de Chi-nito.</span></div>
  </div>
}
