import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, History, Pencil, ShoppingBag, Trash2, UserRound, X } from 'lucide-react'
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'
import { supabase, supabaseConfigured } from './supabase'

const LEGAL_VERSION='2026-09-26'
const formatPersonName=(value='')=>String(value||'')
  .trim()
  .replace(/\s+/g,' ')
  .toLocaleLowerCase('es-MX')
  .replace(/(^|[\s'-])(\p{L})/gu,(_match,prefix,letter)=>`${prefix}${letter.toLocaleUpperCase('es-MX')}`)

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
const formatOrderDate=(value)=>{
  if(!value)return ''
  try{return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
  catch{return ''}
}
const customerStatusLabel=(status)=>status==='Listo'?'Listo para recoger':status==='Nuevo'?'Preparando':status

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
      {sortedCountries.map(c=><option key={c.code} value={c.code}>{flag(c.code)} +{c.dial}</option>)}
    </select>
    <input type="tel" inputMode="tel" autoComplete="tel-national" value={number}
      onChange={e=>onNumber(e.target.value.replace(/[^0-9\s()-]/g,''))}
      aria-label="Número de teléfono" placeholder="Número de teléfono" maxLength={25} required />
  </div>
}

export default function ProfileDrawer({session,intent,name,phone,cashbackBalance=0,cashbackLoading=false,onSave,onClose,onAuthenticated,onRecoveryComplete}){
  const [view,setView]=useState('login')
  const [editingProfile,setEditingProfile]=useState(false)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [fullName,setFullName]=useState('')
  const [registerEmail,setRegisterEmail]=useState('')
  const [registerPassword,setRegisterPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmNewPassword,setConfirmNewPassword]=useState('')
  const [phoneCountry,setPhoneCountry]=useState('MX')
  const [phoneNumber,setPhoneNumber]=useState('')
  const [profileName,setProfileName]=useState(name||'')
  const [profileEmail,setProfileEmail]=useState(session?.user?.email||'')
  const [profilePhone,setProfilePhone]=useState(()=>splitPhone(phone))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [acceptedLegal,setAcceptedLegal]=useState(false)
  const [deleteConfirm,setDeleteConfirm]=useState(false)
  const [showOrders,setShowOrders]=useState(false)
  const [orderHistory,setOrderHistory]=useState([])
  const [ordersLoading,setOrdersLoading]=useState(false)
  const [ordersError,setOrdersError]=useState('')
  const signedIn=!!session?.user
  const phonePreview=useMemo(()=>normalizedPhone(phoneCountry,phoneNumber),[phoneCountry,phoneNumber])

  useEffect(()=>{setProfileName(formatPersonName(name||''));setProfilePhone(splitPhone(phone));setProfileEmail(session?.user?.email||'')},[name,phone,session?.user?.id,session?.user?.email])
  useEffect(()=>{
    const key=(e)=>{if(e.key==='Escape'&&!busy)onClose()}
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[busy,onClose])
  useEffect(()=>{
    const userId=session?.user?.id
    if(!supabase||!userId||!showOrders)return
    let alive=true
    const loadOrders=async()=>{
      setOrdersLoading(true);setOrdersError('')
      const {data,error:historyError}=await supabase.from('orders')
        .select('id,order_number,total,status,created_at,pickup_label,order_items(id,name,quantity,variant)')
        .eq('customer_id',userId)
        .order('created_at',{ascending:false})
        .limit(50)
      if(!alive)return
      if(historyError){setOrdersError('No pudimos cargar tus pedidos.');setOrderHistory([])}
      else setOrderHistory(data||[])
      setOrdersLoading(false)
    }
    loadOrders()
    const channel=supabase.channel(`customer-order-history-${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`customer_id=eq.${userId}`},loadOrders)
      .subscribe()
    return ()=>{alive=false;supabase.removeChannel(channel)}
  },[session?.user?.id,showOrders])

  const clearMessages=()=>{setError('');setNotice('')}
  const showRegister=()=>{clearMessages();setAcceptedLegal(false);setRegisterEmail(email);setView('register')}
  const showLogin=()=>{clearMessages();setView('login')}
  const showForgot=()=>{clearMessages();setView('forgot')}

  const requestPasswordReset=async(e)=>{
    e.preventDefault();clearMessages()
    if(!supabaseConfigured||!supabase){setError('Falta conectar Supabase en este proyecto de Vercel.');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError('Escribe el correo de tu cuenta.');return}
    setBusy(true)
    try{
      const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{
        redirectTo:`${window.location.origin}${window.location.pathname}`,
      })
      if(resetError)throw resetError
      setNotice('Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo y abre el enlace desde este dispositivo.')
    }catch(err){setError(err.message||'No pudimos enviar el correo de recuperación. Intenta de nuevo.')}
    finally{setBusy(false)}
  }

  const changeRecoveredPassword=async(e)=>{
    e.preventDefault();clearMessages()
    if(newPassword.length<8){setError('La nueva contraseña debe tener al menos 8 caracteres.');return}
    if(newPassword!==confirmNewPassword){setError('Las contraseñas no coinciden.');return}
    setBusy(true)
    try{
      const {error:updateError}=await supabase.auth.updateUser({password:newPassword})
      if(updateError)throw updateError
      setNewPassword('');setConfirmNewPassword('')
      setNotice('Tu contraseña se actualizó correctamente.')
      onRecoveryComplete?.()
    }catch(err){setError(err.message||'No pudimos actualizar tu contraseña. Solicita un nuevo enlace e intenta otra vez.')}
    finally{setBusy(false)}
  }

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
    if(!acceptedLegal){setError('Debes aceptar los Términos y condiciones y la Política de privacidad.');return}
    const normalizedName=formatPersonName(fullName)
    const acceptedAt=new Date().toISOString()
    setBusy(true)
    try{
      const {data,error:authError}=await supabase.auth.signUp({
        email:registerEmail.trim().toLowerCase(),password:registerPassword,
        options:{
          emailRedirectTo:window.location.origin+window.location.pathname,
          data:{
            full_name:normalizedName,
            phone_e164:phonePreview,
            phone_country:phoneCountry,
            legal_version:LEGAL_VERSION,
            terms_accepted_at:acceptedAt,
            privacy_accepted_at:acceptedAt,
          },
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
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())){setError('Escribe un correo electrónico válido.');return}
    const normalizedName=formatPersonName(profileName)
    setBusy(true)
    try{
      await onSave({fullName:normalizedName,phoneNumber:normalizedPhone(profilePhone.country,profilePhone.number)})
      setProfileName(normalizedName)
      const nextEmail=profileEmail.trim().toLowerCase()
      if(nextEmail!==String(session.user.email||'').toLowerCase()){
        const {error:emailError}=await supabase.auth.updateUser({email:nextEmail},{emailRedirectTo:window.location.origin+window.location.pathname})
        if(emailError)throw emailError
        setNotice('Datos guardados. Revisa tu correo para confirmar el cambio de dirección.')
      }else{setNotice('Tus datos se guardaron correctamente.')}
      setEditingProfile(false)
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

  const deleteAccount=async()=>{
    clearMessages()
    if(!deleteConfirm){setDeleteConfirm(true);return}
    if(!supabase||!session?.user?.id){setError('No encontramos una sesión activa.');return}
    setBusy(true)
    try{
      const {error:deleteError}=await supabase.rpc('delete_my_account')
      if(deleteError)throw deleteError
      try{await supabase.auth.signOut({scope:'local'})}catch{/* La cuenta ya fue eliminada. */}
      onClose()
    }catch(err){setError(err.message||'No pudimos eliminar tu cuenta. Intenta de nuevo.')}
    finally{setBusy(false)}
  }

  return <div className="profile-drawer-overlay" onClick={onClose} role="presentation">
    <aside className="profile-drawer auth-drawer" onClick={e=>e.stopPropagation()} aria-label="Cuenta y perfil" role="dialog" aria-modal="true">
      <div className="profile-drawer-head">
        <div><small>{intent==='checkout'?'ANTES DE CONTINUAR':intent==='recovery'?'SEGURIDAD':'MI CUENTA'}</small><h2>{intent==='recovery'?'Nueva contraseña':signedIn?(showOrders?'Mis pedidos':'Tu perfil'):view==='register'?'Crear cuenta':view==='forgot'?'Recuperar contraseña':'Bienvenido'}</h2></div>
        <button className="profile-drawer-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={22}/></button>
      </div>
      {intent==='checkout'&&!signedIn&&<p className="auth-checkout-note">Para continuar a Checkout, inicia sesión o crea tu cuenta. Tu carrito se conservará.</p>}
      {error&&<div className="auth-message auth-error" role="alert">{error}</div>}
      {notice&&<div className="auth-message auth-notice" role="status">{notice}</div>}
      {!supabaseConfigured&&<div className="auth-message auth-error">Falta configurar las variables de Supabase en Vercel.</div>}

      {intent==='recovery' ? <>
        <div className="profile-drawer-intro password-recovery-intro">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <p>Escribe una nueva contraseña para tu cuenta de Chi-nito.</p>
        </div>
        <form className="profile-drawer-fields" onSubmit={changeRecoveredPassword}>
          <label>Nueva contraseña<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirmar contraseña<input type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Repite tu nueva contraseña" autoComplete="new-password" minLength={8} required /></label>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Actualizando…':'Guardar nueva contraseña'}</button>
        </form>
      </> : signedIn ? <>
        {showOrders ? <>
          <button className="auth-back" onClick={()=>setShowOrders(false)} type="button"><ArrowLeft size={15}/> Volver a mi perfil</button>
          <div className="profile-orders-head"><div><History size={18}/><div><b>Historial de pedidos</b><span>Últimos 50 pedidos de tu cuenta</span></div></div></div>
          <div className="profile-orders-list">
            {ordersLoading&&<div className="profile-orders-state">Cargando pedidos…</div>}
            {ordersError&&<div className="profile-orders-state error">{ordersError}</div>}
            {!ordersLoading&&!ordersError&&!orderHistory.length&&<div className="profile-orders-empty"><ShoppingBag size={28}/><b>Aún no tienes pedidos</b><span>Cuando completes tu primera orden aparecerá aquí.</span></div>}
            {!ordersLoading&&orderHistory.map(order=><article className="profile-order-card" key={order.id}>
              <div className="profile-order-top"><div><b>{order.order_number}</b><span>{formatOrderDate(order.created_at)}</span></div><em className={`profile-order-status ${String(order.status||'').toLowerCase()}`}>{customerStatusLabel(order.status)}</em></div>
              <div className="profile-order-items">{(order.order_items||[]).slice(0,3).map(item=><span key={item.id}>{item.quantity>1?`${item.quantity}× `:''}{item.name}{item.variant?` · ${item.variant}`:''}</span>)}{(order.order_items||[]).length>3&&<span>+{order.order_items.length-3} producto{order.order_items.length-3===1?'':'s'} más</span>}</div>
              <div className="profile-order-bottom"><span>{order.pickup_label||'Pickup'}</span><strong>${Number(order.total||0).toFixed(2)}</strong></div>
            </article>)}
          </div>
        </> : <>
          <div className="profile-drawer-user">
            <div className="profile-drawer-avatar"><UserRound size={30}/></div>
            <div><b>{formatPersonName(name)||'Cliente Chi-nito'}</b><span>{session.user.email}</span></div>
          </div>
          {!editingProfile ? <>
            <div className="profile-static-info">
              <div><small>Nombre completo</small><strong>{formatPersonName(name)||'Sin registrar'}</strong></div>
              <div><small>Número de teléfono</small><strong>{phone||'Sin registrar'}</strong></div>
              <div><small>Correo electrónico</small><strong>{session.user.email||'Sin registrar'}</strong></div>
              <div className="profile-cashback-balance"><small>Cashback</small><strong>{cashbackLoading?'Consultando…':`$${cashbackBalance.toFixed(2)}`}</strong><span>Recibes $1 por cada $10 al completar un pedido.</span></div>
            </div>
            <button className="profile-orders-button" type="button" onClick={()=>{clearMessages();setShowOrders(true)}}><History size={16}/><span><b>Ver pedidos</b><small>Consulta tu historial</small></span><ChevronRight size={17}/></button>
            <button className="profile-drawer-edit" type="button" onClick={()=>{clearMessages();setProfileName(formatPersonName(name||''));setProfilePhone(splitPhone(phone));setProfileEmail(session.user.email||'');setEditingProfile(true)}}><Pencil size={15}/> Editar perfil</button>
          </> : <>
            <button className="auth-back" onClick={()=>{clearMessages();setEditingProfile(false)}} type="button"><ArrowLeft size={15}/> Volver a mi perfil</button>
            <form className="profile-drawer-fields" onSubmit={saveProfile}>
              <label>Nombre completo<input value={profileName} onChange={e=>setProfileName(e.target.value)} autoComplete="name" required /></label>
              <label>Teléfono
                <PhoneField idPrefix="profile" country={profilePhone.country} number={profilePhone.number}
                  onCountry={country=>setProfilePhone(prev=>({...prev,country}))}
                  onNumber={number=>setProfilePhone(prev=>({...prev,number}))}/>
              </label>
              <label>Correo electrónico<input type="email" value={profileEmail} onChange={e=>setProfileEmail(e.target.value)} autoComplete="email" required /></label>
              <button className="primary profile-drawer-save" type="submit" disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</button>
            </form>
            <div className="profile-delete-zone">
              {!deleteConfirm ? <button className="profile-delete-button" type="button" disabled={busy} onClick={deleteAccount}><Trash2 size={15}/> Eliminar cuenta</button> : <div className="profile-delete-confirm">
                <strong>¿Eliminar tu cuenta definitivamente?</strong>
                <p>Se eliminarán tu acceso y los datos de tu perfil. Esta acción no se puede deshacer.</p>
                <div><button type="button" onClick={()=>setDeleteConfirm(false)} disabled={busy}>Cancelar</button><button className="danger" type="button" onClick={deleteAccount} disabled={busy}>{busy?'Eliminando…':'Sí, eliminar cuenta'}</button></div>
              </div>}
            </div>
          </>}
          <button className="profile-drawer-logout" onClick={logout} type="button" disabled={busy}>Cerrar sesión</button>
        </>}
      </> : view==='login' ? <>
        <div className="profile-drawer-intro">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <p>Accede a tu cuenta para realizar pedidos y conservar tus datos para próximas compras.</p>
        </div>
        <form className="profile-drawer-fields" onSubmit={login}>
          <label>Correo electrónico<input type="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="username" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" required /></label>
          <button className="auth-forgot-link" type="button" onClick={showForgot}>¿Olvidaste tu contraseña?</button>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Ingresando…':'Iniciar sesión'}</button>
        </form>
        <button className="profile-drawer-link" type="button" onClick={showRegister}>¿No tienes cuenta? Regístrate</button>
      </> : view==='forgot' ? <>
        <button className="auth-back" onClick={showLogin} type="button"><ArrowLeft size={15}/> Volver a iniciar sesión</button>
        <div className="profile-drawer-intro forgot-password-intro">
          <p>Te enviaremos un enlace seguro para crear una nueva contraseña.</p>
        </div>
        <form className="profile-drawer-fields" onSubmit={requestPasswordReset}>
          <label>Correo electrónico<input type="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" required /></label>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Enviando…':'Enviar enlace de recuperación'}</button>
        </form>
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
          <div className="auth-legal-consent">
            <input id="accept-legal" type="checkbox" checked={acceptedLegal} onChange={e=>setAcceptedLegal(e.target.checked)} required />
            <label htmlFor="accept-legal">Acepto los <a href="#terms" target="_blank" rel="noreferrer">Términos y condiciones</a> y la <a href="#privacy" target="_blank" rel="noreferrer">Política de privacidad</a>.</label>
          </div>
          <button className="primary profile-drawer-save" type="submit" disabled={busy||!supabaseConfigured}>{busy?'Creando cuenta…':'Registrarme'} <Check size={15}/></button>
        </form>
        <p className="profile-drawer-note">Tu sesión permanecerá iniciada en este dispositivo mientras sea válida y no cierres sesión.</p>
      </>}
    </aside>
  </div>
}
