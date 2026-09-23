import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, UserRound, X } from 'lucide-react'
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'
import { supabase, supabaseConfigured } from './supabase'

const regionNames=new Intl.DisplayNames(['es'],{type:'region'})
const flag=(code)=>String.fromCodePoint(...code.toUpperCase().split('').map(ch=>127397+ch.charCodeAt(0)))
const COUNTRY_OPTIONS=getCountries()
  .map(code=>({code,label:regionNames.of(code)||code,dial:getCountryCallingCode(code)}))
  .sort((a,b)=>a.label.localeCompare(b.label,'es'))
const sortedCountries=[...COUNTRY_OPTIONS.filter(c=>c.code==='MX'),...COUNTRY_OPTIONS.filter(c=>c.code!=='MX')]
const buildPhone=(country,number)=>{
  const digits=number.replace(/\D/g,'')
  if(!digits)return ''
  return `+${getCountryCallingCode(country)}${digits}`
}
const normalizedPhone=(country,number)=>{
  try {
    const parsed=parsePhoneNumberFromString(buildPhone(country,number),country)
    return parsed?.isValid()?parsed.number:null
  }catch { return null }
}
const validPhone=(country,number)=>!!normalizedPhone(country,number)
const splitPhone=(saved)=>{
  try {
    const parsed=parsePhoneNumberFromString(saved||'', 'MX')
    if(parsed?.country)return {country:parsed.country,number:parsed.nationalNumber}
  } catch { /* Los números anteriores pueden estar guardados sin prefijo. */ }
  return {country:'MX',number:(saved||'').replace(/\D/g,'')}
}

function PhoneField({country,onCountry,number,onNumber,idPrefix}){
  return <div className="auth-phone-row">
    <select aria-label="País y código telefónico" value={country} onChange={e=>onCountry(e.target.value)} id={`${idPrefix}-country`}>
      {sortedCountries.map(c=><option key={c.code} value={c.code}>{flag(c.code)} +{c.dial} · {c.label}</option>)}
    </select>
    <input type="tel" inputMode="tel" autoComplete="tel-national" value={number}
      onChange={e=>onNumber(e.target.value.replace(/[^0-9\s()-]/g,''))}
      aria-label="Número de teléfono" placeholder="Número de teléfono" maxLength={25} required />
  </div>
}

export default function ProfileDrawer({session,intent,name,phone,onSave,onClose,onAuthenticated}){
  const [view,setView]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [fullName,setFullName]=useState('')
  const [registerEmail,setRegisterEmail]=useState('')
  const [registerPassword,setRegisterPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [phoneCountry,setPhoneCountry]=useState('MX')
  const [phoneNumber,setPhoneNumber]=useState('')
  const [profileName,setProfileName]=useState(name||'')
  const [profilePhone,setProfilePhone]=useState(()=>splitPhone(phone))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const signedIn=!!session?.user
  const phonePreview=useMemo(()=>normalizedPhone(phoneCountry,phoneNumber),[phoneCountry,phoneNumber])

  useEffect(()=>{setProfileName(name||'');setProfilePhone(splitPhone(phone))},[name,phone,session?.user?.id])
  useEffect(()=>{
    const key=(e)=>{if(e.key==='Escape'&&!busy)onClose()}
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[busy,onClose])
  const clearMessages=()=>{setError('');setNotice('')}
  const showRegister=()=>{clearMessages();setRegisterEmail(email);setView('register')}
  const showLogin=()=>{clearMessages();setView('login')}

  const login=async(e)=>{
    e.preventDefault();clearMessages()
    if(!supabaseConfigured||!supabase){setError('Falta conectar Supabase en este proyecto de Vercel.');return}
    if(!email.trim()||!password){setError('Escribe tu correo y contraseña.');return}
    setBusy(true)
    try{
      const {data,error:authError}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
      if(authError)throw authError
      if(!data.session){setNotice('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');return}
      setPassword('')
      onAuthenticated()
    }catch(err){setError(err.message||'No se pudo iniciar sesión. Revisa tus datos.')}
    finally{setBusy(false)}
  }

  const register=async(e)=>{
    e.preventDefault();clearMessages()
    if(!supabaseConfigured||!supabase){setError('Falta conectar Supabase en este proyecto de Vercel.');return}
    if(fullName.trim().length<2){setError('Escribe tu nombre completo.');return}
    if(!validPhone(phoneCountry,phoneNumber)){setError('Escribe un número válido para el país seleccionado.');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail.trim())){setError('Escribe un correo electrónico válido.');return}
    if(registerPassword.length<8){setError('La contraseña debe tener al menos 8 caracteres.');return}
    if(registerPassword!==confirmPassword){setError('Las contraseñas no coinciden.');return}
    setBusy(true)
    try{
      const {data,error:authError}=await supabase.auth.signUp({
        email:registerEmail.trim().toLowerCase(),password:registerPassword,
        options:{
          emailRedirectTo:window.location.origin+window.location.pathname,
          data:{full_name:fullName.trim(),phone_e164:phonePreview,phone_country:phoneCountry},
        },
      })
      if(authError)throw authError
      setRegisterPassword('');setConfirmPassword('')
      if(data.session){onAuthenticated();return}
      setNotice('Revisa tu correo y confirma tu cuenta. Después regresa a Chi-nito e inicia sesión para continuar con tu pedido.')
    }catch(err){setError(err.message||'No pudimos crear tu cuenta. Intenta de nuevo.')}
    finally{setBusy(false)}
  }

  const saveProfile=async(e)=>{
    e.preventDefault();clearMessages()
    if(profileName.trim().length<2){setError('Escribe tu nombre completo.');return}
    if(!validPhone(profilePhone.country,profilePhone.number)){setError('Introduce un número de teléfono válido.');return}
    setBusy(true)
    try{
      await onSave({fullName:profileName,phoneNumber:normalizedPhone(profilePhone.country,profilePhone.number)})
      setNotice('Tus datos se guardaron correctamente.')
    }catch(err){setError(err.message||'No pudimos guardar tus cambios.')}
    finally{setBusy(false)}
  }

  const logout=async()=>{
    clearMessages();setBusy(true)
    try{
      const {error:logoutError}=await supabase.auth.signOut()
      if(logoutError)throw logoutError
      onClose()
    }catch(err){setError(err.message||'No se pudo cerrar sesión.')}
    finally{setBusy(false)}
  }

  return <div className="profile-drawer-overlay" onClick={onClose} role="presentation">
    <aside className="profile-drawer auth-drawer" onClick={e=>e.stopPropagation()} aria-label="Cuenta y perfil" role="dialog" aria-modal="true">
      <div className="profile-drawer-head">
        <div><small>{intent==='checkout'?'ANTES DE CONTINUAR':'MI CUENTA'}</small><h2>{signedIn?'Tu perfil':view==='register'?'Crear cuenta':'Bienvenido'}</h2></div>
        <button className="profile-drawer-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={22}/></button>
      </div>
      {intent==='checkout'&&!signedIn&&<p className="auth-checkout-note">Para continuar a Checkout, inicia sesión o crea tu cuenta. Tu carrito se conservará.</p>}
      {error&&<div className="auth-message auth-error" role="alert">{error}</div>}
      {notice&&<div className="auth-message auth-notice" role="status">{notice}</div>}
      {!supabaseConfigured&&<div className="auth-message auth-error">Falta configurar las variables de Supabase en Vercel.</div>}

      {signedIn ? <>
        <div className="profile-drawer-user">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <div><b>{name||'Cliente Chi-nito'}</b><span>{session.user.email}</span></div>
        </div>
        <form className="profile-drawer-fields" onSubmit={saveProfile}>
          <label>Nombre completo<input value={profileName} onChange={e=>setProfileName(e.target.value)} autoComplete="name" required /></label>
          <label>Teléfono
            <PhoneField idPrefix="profile" country={profilePhone.country} number={profilePhone.number}
              onCountry={country=>setProfilePhone(prev=>({...prev,country}))}
              onNumber={number=>setProfilePhone(prev=>({...prev,number}))}/>
          </label>
          <label>Correo electrónico<input value={session.user.email||''} readOnly aria-label="Correo electrónico de la cuenta" /></label>
          <button className="primary profile-drawer-save" type="submit" disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</button>
        </form>
        <button className="profile-drawer-logout" onClick={logout} type="button" disabled={busy}>Cerrar sesión</button>
      </> : view==='login' ? <>
        <div className="profile-drawer-intro">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <p>Accede a tu cuenta para realizar pedidos y conservar tus datos para próximas compras.</p>
        </div>
        <form className="profile-drawer-fields" onSubmit={login}>
          <label>Correo electrónico<input type="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="username" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" required /></label>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Ingresando…':'Iniciar sesión'}</button>
        </form>
        <button className="profile-drawer-link" type="button" onClick={showRegister}>¿No tienes cuenta? Regístrate</button>
      </> : <>
        <button className="auth-back" onClick={showLogin} type="button"><ArrowLeft size={15}/> Ya tengo cuenta</button>
        <form className="profile-drawer-fields" onSubmit={register}>
          <label>Nombre completo<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" required /></label>
          <label>Número de teléfono
            <PhoneField idPrefix="register" country={phoneCountry} onCountry={setPhoneCountry} number={phoneNumber} onNumber={setPhoneNumber}/>
          </label>
          <label>Correo electrónico<input type="email" inputMode="email" value={registerEmail} onChange={e=>setRegisterEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" required /></label>
          <label>Contraseña<input type="password" value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirmar contraseña<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" autoComplete="new-password" minLength={8} required /></label>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Creando cuenta…':'Registrarme'} <Check size={15}/></button>
        </form>
        <p className="profile-drawer-note">Tu sesión permanecerá iniciada en este dispositivo mientras sea válida y no cierres sesión.</p>
      </>}
    </aside>
  </div>
}
