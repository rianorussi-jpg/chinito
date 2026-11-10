import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Check, ChefHat, Clock3, CloudRain, CreditCard, Eye, Flame, LogOut, Minus, Phone, Plus, Printer, RotateCcw, ShoppingBag, UtensilsCrossed, UserRound, X } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const orderSelect='id,order_number,customer_name,customer_phone,pickup_label,payment_method,payment_status,settlement_method,total,status,cashback_used,first_order_discount,rain_delivery_fee,tip_amount,cash_received,change_due,card_folio,paid_at,kitchen_acknowledged_at,created_at,order_items(id,item_type,name,quantity,unit_price,base_name,guisados,extras,variant)'
const tableItemSelect='id,batch_id,item_type,catalog_slug,name,quantity,unit_price,base_name,guisados,extras,variant,created_at'
const tableTabSelect=`id,table_number,status,total,tip_amount,payment_method,cash_received,change_due,card_folio,opened_at,closed_at,updated_at,table_tab_items(${tableItemSelect})`
const activeStatuses=['Nuevo','Preparando','Listo']
const PICKUP_DAY_INDEX={domingo:0,lunes:1,martes:2,'miércoles':3,miercoles:3,jueves:4,viernes:5,'sábado':6,sabado:6}
const isScheduledPickup=(label='')=>/^(?:(?:Mañana|Domingo|Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado)\s*·\s*)?\d{2}:\d{2}$/i.test(String(label||'').trim())
const displayPickupLabel=(label='')=>String(label||'').replace(/Lo antes posible\s*·\s*20[–-]30 min/i,'Lo antes posible · 10–15 min')
const scheduledPickupAt=(order)=>{
  if(!isScheduledPickup(order?.pickup_label))return null
  const raw=String(order.pickup_label||'').trim()
  const prefixMatch=raw.match(/^([^·]+)\s*·\s*/i)
  const prefix=prefixMatch?.[1]?.trim().toLocaleLowerCase('es-MX')||''
  const time=prefixMatch?raw.slice(prefixMatch[0].length):raw
  const [hours,minutes]=time.split(':').map(Number)
  const scheduled=new Date(order.created_at)
  scheduled.setHours(hours,minutes,0,0)

  if(prefix==='mañana'){
    scheduled.setDate(scheduled.getDate()+1)
  }else if(prefix&&Object.prototype.hasOwnProperty.call(PICKUP_DAY_INDEX,prefix)){
    const target=PICKUP_DAY_INDEX[prefix]
    const current=scheduled.getDay()
    let daysAhead=(target-current+7)%7
    if(daysAhead===0&&scheduled.getTime()<=new Date(order.created_at).getTime())daysAhead=7
    scheduled.setDate(scheduled.getDate()+daysAhead)
  }
  return scheduled
}
const minutesUntilPickup=(order,now=Date.now())=>{
  const scheduled=scheduledPickupAt(order)
  return scheduled?Math.ceil((scheduled.getTime()-now)/60000):null
}
const isWaitingScheduledOrder=(order,now=Date.now())=>{
  if(order?.status==='Listo'||!isScheduledPickup(order?.pickup_label))return false
  const scheduled=scheduledPickupAt(order)
  return Boolean(scheduled&&scheduled.getTime()-now>15*60*1000)
}


const RECEIPT_COLS=36
const thermalPlain=value=>String(value??'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[“”]/g,'"')
  .replace(/[‘’]/g,"'")
  .replace(/·/g,'-')
  .replace(/…/g,'...')
  .replace(/[^\x20-\x7E\n]/g,'')
const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))
const thermalWrap=(value,width=RECEIPT_COLS)=>{
  const text=thermalPlain(value).replace(/\s+/g,' ').trim()
  if(!text)return []
  const words=text.split(' '),lines=[]
  let line=''
  for(const word of words){
    if(word.length>width){
      if(line){lines.push(line);line=''}
      for(let i=0;i<word.length;i+=width)lines.push(word.slice(i,i+width))
    }else if(!line)line=word
    else if(line.length+1+word.length<=width)line+=` ${word}`
    else{lines.push(line);line=word}
  }
  if(line)lines.push(line)
  return lines
}
const thermalCenter=value=>{
  const text=thermalPlain(value).trim().slice(0,RECEIPT_COLS)
  return `${' '.repeat(Math.max(0,Math.floor((RECEIPT_COLS-text.length)/2)))}${text}`
}
const thermalRule=(char='-')=>char.repeat(RECEIPT_COLS)
const thermalPair=(left,right)=>{
  const l=thermalPlain(left).trim(),r=thermalPlain(right).trim()
  if(!r)return thermalWrap(l)
  if(l.length+r.length+1<=RECEIPT_COLS)return [`${l}${' '.repeat(RECEIPT_COLS-l.length-r.length)}${r}`]
  return [...thermalWrap(l),...thermalWrap(r).map(x=>x.padStart(RECEIPT_COLS))]
}
const thermalMoney=value=>`$${Number(value||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const thermalDate=value=>new Date(value).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
const paymentLabel=order=>{
  const settled=String(order?.settlement_method||'').toLowerCase()
  if(settled==='cash')return 'Efectivo'
  if(settled==='card')return 'Tarjeta'
  if(settled==='online')return 'Tarjeta en linea'
  const method=String(order?.payment_method||'').toLowerCase()
  if(['card','stripe','online','online_card'].includes(method))return 'Tarjeta en linea'
  if(['cash','efectivo'].includes(method))return 'Efectivo'
  if(['terminal','pos'].includes(method))return 'Terminal'
  if(method==='pickup')return 'Pago al recoger'
  return method?method:'No especificado'
}
const paymentStatusLabel=order=>order?.payment_status==='paid'?'PAGADO':'PENDIENTE'
const orderSubtotal=order=>Math.max(0,Number(order?.total||0)+Number(order?.cashback_used||0)+Number(order?.first_order_discount||0)-Number(order?.rain_delivery_fee||0))

function kitchenProductLines(order){
  const lines=[]
  for(const item of (order.order_items||[])){
    const qty=Math.max(1,Number(item.quantity||1))
    lines.push(...thermalWrap(`${qty}x ${item.name||'Producto'}`))
    if(item.base_name)lines.push(...thermalWrap(`  BASE: ${item.base_name}`))
    if(item.variant)lines.push(...thermalWrap(`  ${item.variant}`))
    if(Array.isArray(item.guisados)&&item.guisados.length){
      lines.push(...thermalWrap('  GUISADOS:'))
      item.guisados.forEach(g=>lines.push(...thermalWrap(`    - ${g}`)))
    }
    if(Array.isArray(item.extras)&&item.extras.length){
      lines.push(...thermalWrap('  EXTRAS:'))
      item.extras.forEach(extra=>{
        const extraQty=Math.max(1,Number(extra?.quantity||1))
        lines.push(...thermalWrap(`    - ${extraQty>1?`${extraQty}x `:''}${extra?.name||'Extra'}`))
      })
    }
    lines.push(thermalRule('-'))
  }
  return lines
}

function saleProductLines(order){
  const lines=[]
  for(const item of (order.order_items||[])){
    const qty=Math.max(1,Number(item.quantity||1))
    const unit=Number(item.unit_price||0)
    lines.push(...thermalPair(`${qty}x ${item.name||'Producto'}`,thermalMoney(unit*qty)))
    if(item.base_name)lines.push(...thermalWrap(`  Base: ${item.base_name}`))
    if(item.variant)lines.push(...thermalWrap(`  ${item.variant}`))
    if(Array.isArray(item.guisados)&&item.guisados.length)lines.push(...thermalWrap(`  Guisados: ${item.guisados.join(', ')}`))
    if(Array.isArray(item.extras)&&item.extras.length){
      const extras=item.extras.map(extra=>`${Number(extra?.quantity||1)>1?`${extra.quantity}x `:''}${extra?.name||'Extra'}`).join(', ')
      lines.push(...thermalWrap(`  Extras: ${extras}`))
    }
  }
  return lines
}

const thermalStyles=`
  @page{margin:2mm 3mm 5mm}
  html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important}
  body{font-family:"Courier New",Courier,monospace!important}
  .receipt{box-sizing:border-box!important;width:70mm!important;max-width:70mm!important;margin:0!important;padding:0!important}
  .ticket-line{display:block!important;box-sizing:border-box!important;width:100%!important;min-height:3.3mm!important;margin:0!important;padding:0!important;white-space:pre-wrap!important;word-break:normal!important;overflow-wrap:break-word!important;font-family:"Courier New",Courier,monospace!important;font-size:8.2pt!important;line-height:1.25!important;font-weight:600!important;letter-spacing:0!important;color:#000!important;clear:both!important;break-inside:avoid!important}
  .ticket-line.blank{height:3.3mm!important;min-height:3.3mm!important}
  @media print{
    html,body{width:auto!important;max-width:none!important}
    .receipt{width:70mm!important;max-width:70mm!important}
    body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  }
`

function reserveThermalPrint(){
  return window.open('','_blank','width=480,height=820')
}

function openThermalPrint(order,lines,title,options={}){
  const popup=Object.prototype.hasOwnProperty.call(options,'popup')?options.popup:window.open('','_blank','width=480,height=820')
  if(!popup){window.alert('La cuenta se guardó, pero el navegador bloqueó la ventana de impresión. Permite ventanas emergentes para Cocina.');return}
  const htmlLines=lines.map(line=>line.length?`<div class="ticket-line">${escapeHtml(line)}</div>`:'<div class="ticket-line blank">&nbsp;</div>').join('')
  popup.document.open()
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} ${escapeHtml(order.order_number||'')}</title><style>${thermalStyles}</style></head><body><main class="receipt">${htmlLines}</main><script>window.onload=()=>setTimeout(()=>{window.print();window.onafterprint=()=>window.close()},350)<\/script></body></html>`)
  popup.document.close()
}

function printKitchenTicket(order){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET COCINA'),
    thermalRule('='),
    ...thermalWrap(`PEDIDO: ${order.order_number||''}`),
    ...thermalWrap(`PICKUP: ${displayPickupLabel(order.pickup_label)||'Lo antes posible'}`),
    ...thermalWrap(`HORA PEDIDO: ${new Date(order.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`),
    thermalRule('='),
    ...kitchenProductLines(order),
    '', '', ''
  ]
  openThermalPrint(order,lines,'Ticket cocina')
}

function printSaleTicket(order,popup=null){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET DE VENTA'),
    thermalRule('='),
    ...thermalWrap(`PEDIDO: ${order.order_number||''}`),
    ...thermalWrap(`FECHA: ${thermalDate(order.paid_at||order.created_at)}`),
    ...thermalWrap(`CLIENTE: ${order.customer_name||'Mostrador'}`)
  ]
  if(order.customer_phone)lines.push(...thermalWrap(`TEL: ${order.customer_phone}`))
  lines.push(
    ...thermalWrap(`PICKUP: ${displayPickupLabel(order.pickup_label)||'Lo antes posible'}`),
    ...thermalWrap(`PAGO: ${paymentLabel(order)} - ${paymentStatusLabel(order)}`),
    thermalRule('='),
    ...saleProductLines(order),
    thermalRule('='),
    ...thermalPair('SUBTOTAL',thermalMoney(orderSubtotal(order)))
  )
  if(Number(order.rain_delivery_fee||0)>0)lines.push(...thermalPair('ENVIO CON LLUVIA',`+${thermalMoney(order.rain_delivery_fee)}`))
  if(Number(order.first_order_discount||0)>0)lines.push(...thermalPair('REGALO PRIMER PEDIDO',`-${thermalMoney(order.first_order_discount)}`))
  if(Number(order.cashback_used||0)>0)lines.push(...thermalPair('CASHBACK',`-${thermalMoney(order.cashback_used)}`))
  lines.push(...thermalPair('TOTAL CONSUMO',thermalMoney(order.total)))
   if(Number(order.tip_amount||0)>0)lines.push(...thermalPair('PROPINA',`+${thermalMoney(order.tip_amount)}`))
   lines.push(...thermalPair('TOTAL PAGADO',thermalMoney(Number(order.total||0)+Number(order.tip_amount||0))))
  if(order.settlement_method==='cash'){
    lines.push(...thermalPair('RECIBIDO',thermalMoney(order.cash_received)))
    lines.push(...thermalPair('CAMBIO',thermalMoney(order.change_due)))
  }else if(order.settlement_method==='card'&&order.card_folio){
    lines.push(...thermalWrap(`FOLIO TARJETA: ${order.card_folio}`))
  }
  lines.push(
    thermalRule('='),
    '',
    thermalCenter('GRACIAS POR SU COMPRA'),
    thermalCenter('ESTE TICKET NO ES COMPROBANTE FISCAL'),
    '', '', ''
  )
  openThermalPrint(order,lines,'Ticket de venta',popup?{popup}:{})
}

function printOrderPreBill(order){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET POR COBRAR'),
    thermalRule('='),
    ...thermalWrap(`PEDIDO: ${order.order_number||''}`),
    ...thermalWrap(`FECHA: ${thermalDate(order.created_at)}`),
    ...thermalWrap(`CLIENTE: ${order.customer_name||'Mostrador'}`)
  ]
  if(order.customer_phone)lines.push(...thermalWrap(`TEL: ${order.customer_phone}`))
  lines.push(
    ...thermalWrap(`PICKUP: ${displayPickupLabel(order.pickup_label)||'Lo antes posible'}`),
    thermalRule('='),
    ...saleProductLines(order),
    thermalRule('='),
    ...thermalPair('SUBTOTAL',thermalMoney(orderSubtotal(order)))
  )
  if(Number(order.rain_delivery_fee||0)>0)lines.push(...thermalPair('ENVIO CON LLUVIA',`+${thermalMoney(order.rain_delivery_fee)}`))
  if(Number(order.first_order_discount||0)>0)lines.push(...thermalPair('REGALO PRIMER PEDIDO',`-${thermalMoney(order.first_order_discount)}`))
  if(Number(order.cashback_used||0)>0)lines.push(...thermalPair('CASHBACK',`-${thermalMoney(order.cashback_used)}`))
  lines.push(
    ...thermalPair('TOTAL A PAGAR',thermalMoney(order.total)),
    thermalRule('='),
    '', '', ''
  )
  openThermalPrint(order,lines,'Ticket por cobrar')
}



function printTableDraftKitchenTicket(tableNumber,cart,openedAt){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('COMANDA MESA'),
    thermalRule('='),
    ...thermalWrap(`MESA: ${tableNumber}`),
    ...thermalWrap(`HORA: ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`),
    ...(openedAt?thermalWrap(`CUENTA ABIERTA: ${thermalDate(openedAt)}`):[]),
    thermalRule('=')
  ]
  for(const row of cart){
    const qty=Math.max(1,Number(row?.payload?.quantity||1))
    lines.push(...thermalWrap(`${qty}x ${row.label||'Producto'}`))
    if(row.detail)lines.push(...thermalWrap(`  ${row.detail}`))
    lines.push(thermalRule('-'))
  }
  lines.push('','','')
  openThermalPrint({order_number:`Mesa ${tableNumber}`},lines,'Comanda mesa')
}

function printTableKitchenTicket(tableNumber,items,openedAt,popup){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('COMANDA MESA'),
    thermalRule('='),
    ...thermalWrap(`MESA: ${tableNumber}`),
    ...thermalWrap(`HORA: ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`),
    ...(openedAt?thermalWrap(`CUENTA ABIERTA: ${thermalDate(openedAt)}`):[]),
    thermalRule('='),
    ...kitchenProductLines({order_items:items}),
    '', '', ''
  ]
  openThermalPrint({order_number:`Mesa ${tableNumber}`},lines,'Comanda mesa',{popup})
}

function printTablePreBill(tab){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('CUENTA MESA'),
    thermalCenter('POR PAGAR'),
    thermalRule('='),
    ...thermalWrap(`MESA: ${tab.table_number}`),
    ...thermalWrap(`APERTURA: ${thermalDate(tab.opened_at)}`),
    ...thermalWrap(`IMPRESO: ${thermalDate(new Date().toISOString())}`),
    thermalRule('='),
    ...saleProductLines({order_items:tab.table_tab_items||[]}),
    thermalRule('='),
    ...thermalPair('TOTAL A PAGAR',thermalMoney(tab.total)),
    thermalRule('='),
    '',
    thermalCenter('GRACIAS'),
    '', '', ''
  ]
  openThermalPrint({order_number:`Mesa ${tab.table_number}`},lines,'Cuenta mesa')
}

function printTableSaleTicket(tab,popup){
  const method=tab.payment_method==='cash'?'Efectivo':'Tarjeta'
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET DE VENTA'),
    thermalRule('='),
    ...thermalWrap(`MESA: ${tab.table_number}`),
    ...thermalWrap(`APERTURA: ${thermalDate(tab.opened_at)}`),
    ...thermalWrap(`COBRO: ${thermalDate(tab.closed_at||new Date().toISOString())}`),
    ...thermalWrap(`PAGO: ${method}`),
    thermalRule('='),
    ...saleProductLines({order_items:tab.table_tab_items||[]}),
    thermalRule('='),
    ...thermalPair('TOTAL CONSUMO',thermalMoney(tab.total))
  ]
  if(Number(tab.tip_amount||0)>0)lines.push(...thermalPair('PROPINA',`+${thermalMoney(tab.tip_amount)}`))
  lines.push(...thermalPair('TOTAL PAGADO',thermalMoney(Number(tab.total||0)+Number(tab.tip_amount||0))))
  if(tab.payment_method==='cash'){
    lines.push(...thermalPair('RECIBIDO',thermalMoney(tab.cash_received)))
    lines.push(...thermalPair('CAMBIO',thermalMoney(tab.change_due)))
  }else if(tab.card_folio){
    lines.push(...thermalWrap(`FOLIO TARJETA: ${tab.card_folio}`))
  }
  lines.push(thermalRule('='),'',thermalCenter('GRACIAS POR SU COMPRA'),thermalCenter('ESTE TICKET NO ES COMPROBANTE FISCAL'),'','','')
  openThermalPrint({order_number:`Mesa ${tab.table_number}`},lines,'Ticket de venta',{popup})
}

export default function App(){
 const [orders,setOrders]=useState([])
 const [menu,setMenu]=useState([])
 const [session,setSession]=useState(null)
 const [authReady,setAuthReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [loading,setLoading]=useState(false)
 const [newOrderOpen,setNewOrderOpen]=useState(false)
 const [scheduledOpen,setScheduledOpen]=useState(false)
 const [tablesVisible,setTablesVisible]=useState(false)
 const [tableTabs,setTableTabs]=useState([])
 const [tablesError,setTablesError]=useState('')
 const [selectedTable,setSelectedTable]=useState(null)
 const [detailOrder,setDetailOrder]=useState(null)
 const [paymentOrder,setPaymentOrder]=useState(null)
 const [clock,setClock]=useState(()=>Date.now())
 const [realtimeState,setRealtimeState]=useState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'connecting')
 const [lastSyncAt,setLastSyncAt]=useState(null)
 const [syncError,setSyncError]=useState('')
 const loadRequestRef=useRef(0)

 const validateSession=useCallback(async(nextSession)=>{
   if(!nextSession || !supabase){setSession(null);setAuthReady(true);return}
   const {data,error}=await supabase.from('staff_users').select('role,active').eq('user_id',nextSession.user.id).maybeSingle()
   if(error || !data?.active || !['admin','kitchen'].includes(data.role)){
     setAuthError('Esta cuenta no tiene acceso a Cocina.')
     await supabase.auth.signOut()
     setSession(null)
   }else{
     setAuthError('')
     setSession(nextSession)
   }
   setAuthReady(true)
 },[])

 useEffect(()=>{
   if(!supabaseConfigured){setAuthReady(true);return}
   supabase.auth.getSession().then(({data})=>validateSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>validateSession(next),0)})
   return ()=>subscription.unsubscribe()
 },[validateSession])

 const loadOrders=useCallback(async({silent=false}={})=>{
   if(!supabase || !session)return false
   const requestId=++loadRequestRef.current
   if(!silent)setLoading(true)
   try{
     const {data,error}=await supabase.from('orders').select(orderSelect).in('status',activeStatuses).or('payment_method.eq.pickup,payment_status.eq.paid').order('created_at',{ascending:true})
     if(error)throw error
     if(requestId!==loadRequestRef.current)return false
     const nextOrders=data||[]
     setOrders(nextOrders)
     setDetailOrder(current=>current?nextOrders.find(o=>String(o.id)===String(current.id))||current:current)
     setLastSyncAt(new Date())
     setSyncError('')
     return true
   }catch(error){
     if(requestId===loadRequestRef.current){
       console.error('Kitchen orders load error',error)
       setSyncError('No se pudo actualizar la lista de pedidos. Se reintentará automáticamente.')
     }
     return false
   }finally{
     if(requestId===loadRequestRef.current&&!silent)setLoading(false)
   }
 },[session])

 const loadMenu=useCallback(async()=>{
   if(!supabase || !session)return
   const {data,error}=await supabase.from('menu_items').select('*').eq('active',true).order('sort_order',{ascending:true})
   if(!error&&data)setMenu(data)
 },[session])


 const loadTables=useCallback(async()=>{
   if(!supabase || !session)return false
   const {data,error}=await supabase.from('table_tabs').select(tableTabSelect).eq('status','open').order('table_number',{ascending:true})
   if(error){
     console.error('Kitchen tables load error',error)
     setTablesError(error.message||'No se pudieron cargar las mesas.')
     return false
   }
   const normalized=(data||[]).map(tab=>({...tab,table_tab_items:[...(tab.table_tab_items||[])].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))}))
   setTableTabs(normalized)
   setTablesError('')
   return true
 },[session])

 useEffect(()=>{
   const timer=window.setInterval(()=>setClock(Date.now()),1000)
   return ()=>window.clearInterval(timer)
 },[])

 useEffect(()=>{
   if(!supabase || !session)return
   let disposed=false
   let channel=null
   let reconnectTimer=null
   let channelAttempt=0

   setSyncError('')
   setRealtimeState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'connecting')

   const scheduleReconnect=()=>{
     if(disposed||typeof navigator!=='undefined'&&!navigator.onLine)return
     if(reconnectTimer)window.clearTimeout(reconnectTimer)
     reconnectTimer=window.setTimeout(()=>{
       if(disposed)return
       setRealtimeState('connecting')
       connectRealtime()
     },2500)
   }

   const connectRealtime=()=>{
     if(disposed||!supabase)return
     if(typeof navigator!=='undefined'&&!navigator.onLine){setRealtimeState('offline');return}
     if(channel){
       const oldChannel=channel
       channel=null
       supabase.removeChannel(oldChannel).catch(()=>{})
     }
     const nextChannel=supabase
       .channel(`chinito-kitchen-live-${++channelAttempt}`)
       .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>loadOrders({silent:true}))
       .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},()=>loadOrders({silent:true}))
       .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},()=>loadMenu())
       .on('postgres_changes',{event:'*',schema:'public',table:'table_tabs'},()=>loadTables())
       .on('postgres_changes',{event:'*',schema:'public',table:'table_tab_items'},()=>loadTables())
     channel=nextChannel
     nextChannel.subscribe(status=>{
       if(disposed||channel!==nextChannel)return
       if(status==='SUBSCRIBED'){
         if(reconnectTimer){window.clearTimeout(reconnectTimer);reconnectTimer=null}
         setRealtimeState('live')
         loadOrders({silent:true})
         return
       }
       if(['TIMED_OUT','CHANNEL_ERROR','CLOSED'].includes(status)){
         setRealtimeState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'degraded')
         scheduleReconnect()
       }
     })
   }

   const online=()=>{
     if(disposed)return
     setRealtimeState('connecting')
     loadOrders({silent:true})
     loadMenu()
     loadTables()
     connectRealtime()
   }
   const offline=()=>{if(!disposed)setRealtimeState('offline')}
   const refreshWhenVisible=()=>{
     if(disposed)return
     if(document.visibilityState==='visible'&&(typeof navigator==='undefined'||navigator.onLine)){loadOrders({silent:true});loadTables()}
   }
   const refreshOnFocus=()=>{
     if(disposed)return
     if(typeof navigator==='undefined'||navigator.onLine){loadOrders({silent:true});loadTables()}
   }

   connectRealtime()
   loadOrders()
   loadMenu()
   loadTables()

   const safetyPoll=window.setInterval(()=>{
     if(disposed)return
     const visible=document.visibilityState==='visible'
     const onlineNow=typeof navigator==='undefined'||navigator.onLine
     if(visible&&onlineNow){loadOrders({silent:true});loadTables()}
   },10000)

   window.addEventListener('online',online)
   window.addEventListener('offline',offline)
   window.addEventListener('focus',refreshOnFocus)
   document.addEventListener('visibilitychange',refreshWhenVisible)

   return()=>{
     disposed=true
     loadRequestRef.current+=1
     window.clearInterval(safetyPoll)
     if(reconnectTimer)window.clearTimeout(reconnectTimer)
     window.removeEventListener('online',online)
     window.removeEventListener('offline',offline)
     window.removeEventListener('focus',refreshOnFocus)
     document.removeEventListener('visibilitychange',refreshWhenVisible)
     if(channel){
       const oldChannel=channel
       channel=null
       supabase.removeChannel(oldChannel).catch(()=>{})
     }
   }
 },[session,loadOrders,loadMenu,loadTables])

 const scheduled=useMemo(()=>orders.filter(o=>isWaitingScheduledOrder(o,clock)).sort((a,b)=>scheduledPickupAt(a)-scheduledPickupAt(b)),[orders,clock])
 const scheduledIds=useMemo(()=>new Set(scheduled.map(o=>o.id)),[scheduled])
 const preparing=useMemo(()=>orders.filter(o=>(o.status==='Nuevo'||o.status==='Preparando')&&!scheduledIds.has(o.id)),[orders,scheduledIds])
 const ready=useMemo(()=>orders.filter(o=>o.status==='Listo'),[orders])
 const tableTabsByNumber=useMemo(()=>new Map(tableTabs.map(tab=>[Number(tab.table_number),tab])),[tableTabs])

 const acknowledge=async(order)=>{
   if(!order?.id||order.kitchen_acknowledged_at)return true
   const acknowledgedAt=new Date().toISOString()
   const {error}=await supabase.from('orders').update({kitchen_acknowledged_at:acknowledgedAt}).eq('id',order.id)
   if(error){
     console.error('Kitchen acknowledge error',error)
     window.alert('No pudimos marcar el pedido como enterado. Revisa la conexión e intenta nuevamente.')
     return false
   }
   setOrders(prev=>prev.map(o=>o.id===order.id?{...o,kitchen_acknowledged_at:acknowledgedAt}:o))
   setDetailOrder(current=>current?.id===order.id?{...current,kitchen_acknowledged_at:acknowledgedAt}:current)
   return true
 }

 const advance=async(order)=>{
   if(order.status!=='Listo'&&!order.kitchen_acknowledged_at){
     window.alert('Primero toca “Enterado” para confirmar que Cocina ya vio este pedido.')
     return
   }
   if(order.status==='Listo'&&order.payment_method==='pickup'&&order.payment_status!=='paid'){
     setPaymentOrder(order)
     return
   }
   const next=order.status==='Listo'?'Entregado':'Listo'
   const {error}=await supabase.from('orders').update({status:next}).eq('id',order.id)
   if(!error){
     if(next==='Entregado'){setOrders(prev=>prev.filter(o=>o.id!==order.id));setDetailOrder(null)}
     else{
       setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
       setDetailOrder(current=>current?.id===order.id?{...current,status:next}:current)
     }
   }
 }

 if(!supabaseConfigured)return <SetupMissing/>
 if(!authReady)return <div className="k-auth"><div className="k-auth-card">Conectando con Supabase…</div></div>
 if(!session)return <KitchenLogin error={authError}/>

 return <div className="kitchen">
  <header><div className="brand"><img src="/logo.jpg" alt="Chi-nito"/><div><span>KITCHEN MODE</span><b>CHI-NITO</b></div></div><div className="header-right"><div className="online" title={syncError||`Última sincronización: ${lastSyncAt?lastSyncAt.toLocaleTimeString('es-MX'):'pendiente'}`}><i style={{background:realtimeState==='live'?'#22c55e':realtimeState==='offline'?'#ef4444':'#f59e0b'}}/> {loading?'Actualizando…':realtimeState==='live'?'En tiempo real':realtimeState==='offline'?'Sin conexión':realtimeState==='degraded'?'Reconectando…':'Conectando…'}</div><div className="online"><Clock3 size={15}/> {new Date(clock).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><button onClick={()=>loadOrders()} aria-label="Actualizar"><RotateCcw size={17}/></button><button onClick={()=>supabase.auth.signOut()} aria-label="Cerrar sesión"><LogOut size={17}/></button></div></header>
  <main>
    <section className="k-head"><div><span className="eyebrow">PEDIDOS EN TIEMPO REAL</span><h1>Kitchen Mode</h1><p>Prepara, libera y entrega pedidos desde una sola vista.</p></div><div className="k-head-actions"><div className="counters"><Counter label="Preparando" n={preparing.length}/><Counter label="Listos" n={ready.length}/></div><button className="scheduled-orders-button" onClick={()=>setScheduledOpen(true)}><Clock3 size={18}/> Pedidos programados <b>{scheduled.length}</b></button><button className="new-order-button" onClick={()=>setNewOrderOpen(true)}><Plus size={19}/> Nuevo pedido rápido</button><button className={`tables-button ${tablesVisible?'active':''}`} onClick={()=>setTablesVisible(v=>!v)}><UtensilsCrossed size={18}/> Mesas <b>{tableTabs.length}</b></button></div></section>

    {tablesVisible&&<TableStrip tabsByNumber={tableTabsByNumber} error={tablesError} onSelect={setSelectedTable}/>}

    <section className="k-board">
      <OrderLane title="Preparando" subtitle="Todos los pedidos activos en preparación" count={preparing.length} tone="prep">
        {preparing.length?preparing.map(o=><Ticket key={o.id} order={o} onAcknowledge={()=>acknowledge(o)} onDetails={()=>setDetailOrder(o)} onAdvance={()=>advance(o)}/>):<LaneEmpty icon={<Flame size={34}/>} title="Sin pedidos preparando" text="Los pedidos activos aparecerán aquí automáticamente, aunque sean de días anteriores."/>}
      </OrderLane>
      <OrderLane title="Listos para recoger" subtitle="Esperando al cliente" count={ready.length} tone="ready">
        {ready.length?ready.map(o=><Ticket key={o.id} order={o} onAcknowledge={()=>acknowledge(o)} onDetails={()=>setDetailOrder(o)} onAdvance={()=>advance(o)}/>):<LaneEmpty icon={<Check size={34}/>} title="Nada listo todavía" text="Cuando marques un pedido como listo aparecerá en esta columna."/>}
      </OrderLane>
    </section>
  </main>
  {detailOrder&&<OrderDetailsModal order={detailOrder} onClose={()=>setDetailOrder(null)} onAcknowledge={()=>acknowledge(detailOrder)} onAdvance={()=>advance(detailOrder)}/>}
  {scheduledOpen&&<ScheduledOrdersModal orders={scheduled} now={clock} onClose={()=>setScheduledOpen(false)}/>}
  {newOrderOpen&&<NewOrderModal menu={menu} onClose={()=>setNewOrderOpen(false)} onCreated={()=>{setNewOrderOpen(false);loadOrders()}}/>}
  {selectedTable&&<TableOrderModal tableNumber={selectedTable} tab={tableTabsByNumber.get(Number(selectedTable))||null} menu={menu} onClose={()=>setSelectedTable(null)} onUpdated={()=>loadTables()} onPaid={()=>{setSelectedTable(null);loadTables()}}/>}
  {paymentOrder&&<OrderPaymentModal order={paymentOrder} onClose={()=>setPaymentOrder(null)} onConfirmed={receipt=>{setPaymentOrder(null);setDetailOrder(null);setOrders(prev=>prev.filter(o=>o.id!==receipt.id));loadOrders({silent:true})}}/>}
 </div>
}


function TableStrip({tabsByNumber,error,onSelect}){
 return <section className="tables-strip-shell">
   <div className="tables-strip-head"><div><span>MESAS</span><b>Cuentas abiertas</b></div><small>Desliza horizontalmente para ver las 15 mesas.</small></div>
   {error&&<div className="tables-strip-error">{error}. Ejecuta la migración de mesas si todavía no la has instalado.</div>}
   <div className="tables-strip-scroll">
     {Array.from({length:15},(_,i)=>i+1).map(number=>{
       const tab=tabsByNumber.get(number)
       return <button key={number} className={`table-chip ${tab?'occupied':'available'}`} onClick={()=>onSelect(number)}>
         <span>Mesa</span><strong>{number}</strong>{tab?<small>${money(tab.total)}</small>:<small>Disponible</small>}
       </button>
     })}
   </div>
 </section>
}

function TipSelector({total,mode,setMode,custom,setCustom,tip}){
 return <section className="tip-selector">
  <div className="tip-selector-title"><div><b>Propina</b><small>Opcional · elige un porcentaje o captura otra cantidad</small></div><strong>{thermalMoney(tip)}</strong></div>
  <div className="tip-selector-options">
   {[0,10,15,20].map(percent=><button type="button" key={percent} className={mode===String(percent)?'selected':''} onClick={()=>setMode(String(percent))}>{percent===0?'Sin propina':`${percent}%`}</button>)}
   <button type="button" className={mode==='custom'?'selected':''} onClick={()=>setMode('custom')}>Otra cantidad</button>
  </div>
  {mode==='custom'&&<label className="tip-custom-field"><span>Propina en pesos</span><div><b>$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="0.00"/></div></label>}
 </section>
}

function TablePaymentModal({tab,onClose,onConfirmed}){
 const [method,setMethod]=useState('cash')
 const [cashReceived,setCashReceived]=useState('')
 const [folio,setFolio]=useState('')
 const [tipMode,setTipMode]=useState('0')
 const [customTip,setCustomTip]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const total=Number(tab?.total||0)
 const tip=tipMode==='custom'?Math.round(Number(customTip||0)*100)/100:Math.round(total*Number(tipMode)/100*100)/100
 const payable=total+tip
 const cash=Number(cashReceived||0)
 const change=Math.max(0,cash-payable)

 const submit=async()=>{
   setError('')
   if(!Number.isFinite(tip)||tip<0||tip>100000){setError('Captura una propina válida.');return}
   if(method==='cash'&&(!cashReceived||cash<payable)){setError('El efectivo recibido debe ser igual o mayor al total.');return}
   if(method==='card'&&!folio.trim()){setError('Captura el folio de la terminal.');return}
   const printWindow=reserveThermalPrint()
   setBusy(true)
   const {data,error:rpcError}=await supabase.rpc('close_table_tab_with_tip',{
     p_table_number:Number(tab.table_number),
     p_payment_method:method,
     p_cash_received:method==='cash'?cash:null,
     p_tip_amount:tip,
     p_card_folio:method==='card'?folio.trim():null,
   })
   setBusy(false)
   if(rpcError){if(printWindow)printWindow.close();setError(rpcError.message||'No se pudo cerrar la cuenta.');return}
   const result=Array.isArray(data)?data[0]:data
   const receipt={...tab,status:'closed',payment_method:method,tip_amount:tip,cash_received:method==='cash'?cash:null,change_due:method==='cash'?Number(result?.change_due??change):null,card_folio:method==='card'?folio.trim():null,closed_at:new Date().toISOString()}
   printTableSaleTicket(receipt,printWindow)
   onConfirmed()
 }

 return <div className="table-payment-overlay" onMouseDown={e=>{e.stopPropagation();onClose()}}>
   <section className="table-payment-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>COBRAR CUENTA</span><h2>Mesa {tab.table_number}</h2><p>Confirma el total y selecciona cómo pagó el cliente.</p></div><button onClick={onClose}><X size={20}/></button></header>
     <div className="table-payment-body">
       <div className="payment-total-card"><span>TOTAL A COBRAR</span><strong>{thermalMoney(total)}</strong><small>Cuenta completa · Mesa {tab.table_number}</small></div>
       <div className="payment-methods">
         <button className={method==='cash'?'active':''} onClick={()=>setMethod('cash')}><Banknote size={24}/><b>Efectivo</b><span>Captura cuánto recibes y calcula el cambio.</span></button>
         <button className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard size={24}/><b>Tarjeta</b><span>Registra el folio de la terminal.</span></button>
       </div>
       <TipSelector total={total} mode={tipMode} setMode={setTipMode} custom={customTip} setCustom={setCustomTip} tip={tip}/>
       <div className="tip-payable-row"><span>Total con propina</span><b>{thermalMoney(payable)}</b></div>
       {method==='cash'?<>
         <label className="payment-field payment-field-large"><span>¿Con cuánto paga?</span><div><b>$</b><input type="number" min={payable} step="0.01" inputMode="decimal" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} autoFocus placeholder={money(payable)}/></div></label>
         <div className={`payment-change-highlight ${cashReceived&&cash>=payable?'ready':''}`}><span>CAMBIO A ENTREGAR</span><strong>{thermalMoney(cashReceived?change:0)}</strong><small>{!cashReceived?'Captura el efectivo recibido.':cash<payable?`Faltan ${thermalMoney(payable-cash)} para completar la cuenta.`:'Verifica el cambio antes de confirmar.'}</small></div>
       </>:<label className="payment-field payment-field-large"><span>Folio de la terminal</span><input value={folio} onChange={e=>setFolio(e.target.value)} placeholder="Ej. 008421" autoFocus/><small>Este folio quedará guardado con el cierre de la mesa.</small></label>}
       {error&&<p className="manual-order-error">{error}</p>}
       <button className="payment-confirm" disabled={busy} onClick={submit}>{busy?'Cobrando…':<>Confirmar cobro · {thermalMoney(payable)} <Printer size={17}/></>}</button>
     </div>
   </section>
 </div>
}

function OrderPaymentModal({order,onClose,onConfirmed}){
 const [method,setMethod]=useState('cash')
 const [cashReceived,setCashReceived]=useState('')
 const [folio,setFolio]=useState('')
 const [tipMode,setTipMode]=useState('0')
 const [customTip,setCustomTip]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const total=Number(order?.total||0)
 const tip=tipMode==='custom'?Math.round(Number(customTip||0)*100)/100:Math.round(total*Number(tipMode)/100*100)/100
 const payable=total+tip
 const cash=Number(cashReceived||0)
 const change=Math.max(0,cash-payable)

 const submit=async()=>{
   setError('')
   if(!Number.isFinite(tip)||tip<0||tip>100000){setError('Captura una propina válida.');return}
   if(method==='cash'&&(!cashReceived||cash<payable)){setError('El efectivo recibido debe ser igual o mayor al total.');return}
   if(method==='card'&&!folio.trim()){setError('Captura el folio de la terminal.');return}
   const printWindow=reserveThermalPrint()
   setBusy(true)
   const {data,error:rpcError}=await supabase.rpc('complete_pickup_order_with_tip',{
     p_order_id:order.id,
     p_settlement_method:method,
     p_cash_received:method==='cash'?cash:null,
     p_tip_amount:tip,
     p_card_folio:method==='card'?folio.trim():null,
   })
   setBusy(false)
   if(rpcError){if(printWindow)printWindow.close();setError(rpcError.message||'No se pudo confirmar el cobro.');return}
   const result=Array.isArray(data)?data[0]:data
   const receipt={...order,status:'Entregado',payment_status:'paid',settlement_method:method,tip_amount:tip,cash_received:method==='cash'?cash:null,change_due:method==='cash'?Number(result?.change_due??change):null,card_folio:method==='card'?folio.trim():null,paid_at:new Date().toISOString()}
   printSaleTicket(receipt,printWindow)
   onConfirmed(receipt)
 }

 return <div className="table-payment-overlay" onMouseDown={e=>{e.stopPropagation();onClose()}}>
   <section className="table-payment-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>ENTREGAR Y COBRAR</span><h2>{order.order_number}</h2><p>Confirma el pago antes de entregar el pedido.</p></div><button onClick={onClose}><X size={20}/></button></header>
     <div className="table-payment-body">
       <div className="payment-total-card"><span>TOTAL A COBRAR</span><strong>{thermalMoney(total)}</strong><small>{order.customer_name||'Mostrador'}</small></div>
       <div className="payment-methods">
         <button className={method==='cash'?'active':''} onClick={()=>setMethod('cash')}><Banknote size={24}/><b>Efectivo</b><span>Captura cuánto recibes y calcula el cambio.</span></button>
         <button className={method==='card'?'active':''} onClick={()=>setMethod('card')}><CreditCard size={24}/><b>Tarjeta</b><span>Registra el folio de la terminal.</span></button>
       </div>
       <TipSelector total={total} mode={tipMode} setMode={setTipMode} custom={customTip} setCustom={setCustomTip} tip={tip}/>
       <div className="tip-payable-row"><span>Total con propina</span><b>{thermalMoney(payable)}</b></div>
       {method==='cash'?<>
         <label className="payment-field payment-field-large"><span>¿Con cuánto paga?</span><div><b>$</b><input type="number" min={payable} step="0.01" inputMode="decimal" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} autoFocus placeholder={money(payable)}/></div></label>
         <div className={`payment-change-highlight ${cashReceived&&cash>=payable?'ready':''}`}><span>CAMBIO A ENTREGAR</span><strong>{thermalMoney(cashReceived?change:0)}</strong><small>{!cashReceived?'Captura el efectivo recibido.':cash<payable?`Faltan ${thermalMoney(payable-cash)} para completar el pedido.`:'Verifica el cambio antes de confirmar.'}</small></div>
       </>:<label className="payment-field payment-field-large"><span>Folio de la terminal</span><input value={folio} onChange={e=>setFolio(e.target.value)} placeholder="Ej. 008421" autoFocus/><small>El folio quedará guardado en el pedido y visible en Panel.</small></label>}
       {error&&<p className="manual-order-error">{error}</p>}
       <button className="payment-confirm" disabled={busy} onClick={submit}>{busy?'Cobrando…':<>Confirmar cobro y entregar · {thermalMoney(payable)} <Printer size={17}/></>}</button>
     </div>
   </section>
 </div>
}

function ProductConfiguratorModal({product,bases,guisados,extras,onClose,onAdd,contextLabel='pedido'}){
 const [base,setBase]=useState(bases[0]||null)
 const [selectedGuisados,setSelectedGuisados]=useState([])
 const [extraQty,setExtraQty]=useState({})
 const [error,setError]=useState('')
 const max=maxGuisadosFor(product)
 const toggleGuisado=(g)=>setSelectedGuisados(prev=>prev.some(x=>x.slug===g.slug)?prev.filter(x=>x.slug!==g.slug):prev.length<max?[...prev,g]:prev)
 const changeExtra=(item,delta)=>setExtraQty(prev=>{
   const next=Math.max(0,Math.min(20,Number(prev[item.slug]||0)+delta))
   const clone={...prev};if(next)clone[item.slug]=next;else delete clone[item.slug];return clone
 })
 const total=Number(product?.price||0)+Number(base?.price||0)+selectedGuisados.reduce((sum,g)=>sum+Number(g.price||0),0)+Object.entries(extraQty).reduce((sum,[slug,qty])=>sum+(Number(extras.find(x=>x.slug===slug)?.price||0)*qty),0)
 const add=()=>{
   setError('')
   if(!base||!selectedGuisados.length){setError(`Selecciona una base y ${max===1?'1 guisado':`hasta ${max} guisados`} para continuar.`);return}
   const chosenExtras=Object.entries(extraQty).map(([slug,quantity])=>({item:extras.find(x=>x.slug===slug),quantity})).filter(x=>x.item)
   onAdd({
     key:`cfg-${Date.now()}-${Math.random()}`,
     label:product.name,
     detail:`${base.name} · ${selectedGuisados.map(g=>g.name).join(', ')}${chosenExtras.length?` · Extras: ${chosenExtras.map(x=>`${x.quantity>1?`${x.quantity}× `:''}${x.item.name}`).join(', ')}`:''}`,
     unit:total,
     payload:{kind:'configured',catalog_slug:product.slug,quantity:1,base_slug:base.slug,guisado_slugs:selectedGuisados.map(g=>g.slug),extras:chosenExtras.map(x=>({catalog_slug:x.item.slug,quantity:x.quantity}))},
   })
   onClose()
 }
 return <div className="product-config-overlay" onMouseDown={e=>{e.stopPropagation();onClose()}}>
   <section className="product-config-modal" onMouseDown={e=>e.stopPropagation()}>
     <header className="product-config-head">
       <div className="product-config-product"><img src={product.image||'/logo.jpg'} alt=""/><div><span>PERSONALIZAR</span><h2>{product.name}</h2><p>Configura este producto antes de agregarlo al {contextLabel}.</p></div></div>
       <button onClick={onClose} aria-label="Cerrar"><X size={21}/></button>
     </header>
     <div className="product-config-content">
       <section className="product-config-section"><div className="product-config-section-title"><span>1</span><div><h3>Elige la base</h3><p>Selecciona una opción.</p></div></div><div className="manual-choice-grid compact">{bases.map(b=><button key={b.slug} className={base?.slug===b.slug?'selected':''} onClick={()=>setBase(b)}><b>{b.name}</b>{Number(b.price)>0&&<span>+${money(b.price)}</span>}</button>)}</div></section>
       <section className="product-config-section"><div className="product-config-section-title"><span>2</span><div><h3>Elige los guisados</h3><p>{selectedGuisados.length} de {max} seleccionados</p></div></div><div className="manual-choice-grid">{guisados.map(g=><button key={g.slug} className={selectedGuisados.some(x=>x.slug===g.slug)?'selected':''} onClick={()=>toggleGuisado(g)}><b>{g.name}</b>{Number(g.price)>0&&<span>+${money(g.price)}</span>}</button>)}</div></section>
       <section className="product-config-section"><div className="product-config-section-title"><span>3</span><div><h3>Extras</h3><p>Opcional. Agrega los que necesites.</p></div></div><div className="manual-extra-grid">{extras.map(item=>{const qty=Number(extraQty[item.slug]||0);return <div key={item.slug}><div><b>{item.name}</b><span>${money(item.price)}</span></div><div className="manual-qty"><button onClick={()=>changeExtra(item,-1)} disabled={!qty}><Minus size={13}/></button><strong>{qty}</strong><button onClick={()=>changeExtra(item,1)}><Plus size={13}/></button></div></div>})}</div></section>
       {error&&<p className="manual-order-error product-config-error">{error}</p>}
     </div>
     <footer className="product-config-footer"><div><span>TOTAL DE {product.name.toUpperCase()}</span><strong>${money(total)}</strong></div><button onClick={add}><Plus size={18}/> Agregar al {contextLabel}</button></footer>
   </section>
 </div>
}

function TableOrderModal({tableNumber,tab,menu,onClose,onUpdated,onPaid}){
 const active=useMemo(()=>menu.filter(x=>x.active!==false),[menu])
 const products=useMemo(()=>active.filter(x=>x.category==='Chi-nito'),[active])
 const bases=useMemo(()=>active.filter(x=>x.category==='Base'),[active])
 const guisados=useMemo(()=>active.filter(x=>x.category==='Guisado'),[active])
 const extras=useMemo(()=>active.filter(x=>['Bebida','Complemento','Extra'].includes(x.category)),[active])
 const complements=useMemo(()=>active.filter(x=>x.category==='Complemento'),[active])
 const drinks=useMemo(()=>active.filter(x=>x.category==='Bebida'),[active])
 const takeaway=useMemo(()=>guisados.filter(x=>x.metadata?.sell_by_volume!==false&&(Number(x.metadata?.half_price)>0||Number(x.metadata?.liter_price)>0)),[guisados])
 const [configProduct,setConfigProduct]=useState(null)
 const [cart,setCart]=useState([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [paymentOpen,setPaymentOpen]=useState(false)
 const existingItems=tab?.table_tab_items||[]
 const currentTotal=Number(tab?.total||0)

 const addSimple=(item,kind,variant=null,priceOverride=null)=>{
   const unit=Number((priceOverride??item.price)||0)
   setCart(prev=>[...prev,{key:`simple-${Date.now()}-${Math.random()}`,label:item.name,detail:variant||item.category,unit,payload:{kind,catalog_slug:item.slug,quantity:1,variant}}])
 }
 const changeCartQty=(key,delta)=>setCart(prev=>prev.flatMap(row=>{
   if(row.key!==key)return [row]
   const quantity=Math.max(0,Math.min(20,Number(row.payload.quantity||1)+delta))
   return quantity?[{...row,payload:{...row.payload,quantity}}]:[]
 }))
 const total=cart.reduce((sum,row)=>sum+row.unit*Number(row.payload.quantity||1),0)
 const newCount=cart.reduce((sum,row)=>sum+Number(row.payload.quantity||1),0)

 const printDraft=()=>{
   setError('')
   if(!cart.length){setError('Agrega al menos un producto para imprimir cocina.');return}
   printTableDraftKitchenTicket(tableNumber,cart,tab?.opened_at||null)
 }

 const addToAccount=async()=>{
   setError('')
   if(!cart.length){setError('Agrega al menos un producto a la cuenta.');return}
   setBusy(true)
   const {error:rpcError}=await supabase.rpc('add_table_items',{p_table_number:Number(tableNumber),p_items:cart.map(row=>row.payload)})
   setBusy(false)
   if(rpcError){setError(rpcError.message||'No se pudieron agregar los productos a la mesa.');return}
   setCart([])
   setConfigProduct(null)
   await onUpdated()
 }

 return <div className="manual-order-overlay table-order-overlay" onMouseDown={onClose}>
   <section className="manual-order-modal table-order-modal" onMouseDown={e=>e.stopPropagation()}>
     <header className="manual-order-head"><div><span>{tab?'CUENTA ABIERTA':'MESA DISPONIBLE'}</span><h2>Mesa {tableNumber}</h2><p>{tab?'Agrega nuevos productos; imprime cocina y agrega a la cuenta por separado.':'La cuenta se abrirá al agregar los primeros productos.'}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={22}/></button></header>
     <div className="manual-order-body table-order-body">
       <div className="manual-order-builder table-menu-builder">
         <section className="manual-section table-menu-intro"><div className="manual-section-title"><span>1</span><div><h3>Elige un Chi-nito</h3><p>Toca un producto para abrir su ventana de personalización.</p></div></div><div className="manual-product-grid">{products.map(p=><button key={p.slug} onClick={()=>setConfigProduct(p)}><img src={p.image||'/logo.jpg'} alt=""/><b>{p.name}</b><span>${money(p.price)}</span></button>)}</div></section>
         <section className="manual-section"><div className="manual-section-title"><span>2</span><div><h3>Complementos y bebidas</h3><p>Se agregan directamente a la nueva comanda.</p></div></div><div className="manual-simple-grid">{[...complements,...drinks].map(item=><button key={item.slug} onClick={()=>addSimple(item,item.category==='Bebida'?'drink':'addon')}><img src={item.image||'/logo.jpg'} alt=""/><div><b>{item.name}</b><span>${money(item.price)}</span></div><Plus size={16}/></button>)}</div></section>
         {takeaway.length>0&&<section className="manual-section"><div className="manual-section-title"><span>3</span><div><h3>Guisados para llevar</h3><p>Agrega medio litro o un litro.</p></div></div><div className="manual-takeaway-grid">{takeaway.map(item=><div key={item.slug}><b>{item.name}</b><div>{Number(item.metadata?.half_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1/2 litro',item.metadata.half_price)}>1/2 L · ${money(item.metadata.half_price)}</button>}{Number(item.metadata?.liter_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1 litro',item.metadata.liter_price)}>1 L · ${money(item.metadata.liter_price)}</button>}</div></div>)}</div></section>}
       </div>

       <aside className="table-side-panel">
         <section className="table-new-block">
           <div className="table-side-heading"><div><span>NUEVA COMANDA</span><h3>Productos nuevos</h3><p>Imprime cocina cuando quieras; agregar a la cuenta no imprime.</p></div><b>{newCount}</b></div>
           <div className="manual-cart-items table-new-items">{cart.length===0?<div className="manual-cart-empty table-cart-empty"><ShoppingBag size={30}/><p>Selecciona productos del menú para comenzar una nueva comanda.</p></div>:cart.map(row=><div className="manual-cart-row" key={row.key}><div><b>{row.label}</b><span>{row.detail}</span><strong>${money(row.unit*Number(row.payload.quantity||1))}</strong></div><div className="manual-cart-qty"><button onClick={()=>changeCartQty(row.key,-1)}><Minus size={13}/></button><b>{row.payload.quantity||1}</b><button onClick={()=>changeCartQty(row.key,1)}><Plus size={13}/></button></div></div>)}</div>
           <div className="table-new-total"><span>Total nuevo</span><strong>${money(total)}</strong></div>
           {error&&<p className="manual-order-error">{error}</p>}
           <div className="table-new-actions"><button className="table-print-kitchen" disabled={busy||!cart.length} onClick={printDraft}><Printer size={17}/> Imprimir cocina</button><button className="manual-submit table-add-submit" disabled={busy||!cart.length} onClick={addToAccount}>{busy?'Guardando…':<>Agregar a la cuenta <Plus size={17}/></>}</button></div>
         </section>

         <section className={`table-account-block ${tab?'open':'empty'}`}>
           <div className="table-account-block-head"><div><span>YA COMANDADO</span><h3>{tab?'Cuenta abierta':'Sin cuenta abierta'}</h3><p>{tab?`Abierta ${new Date(tab.opened_at).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Aparecerá aquí después de enviar la primera comanda.'}</p></div><div><small>TOTAL CUENTA</small><strong>${money(currentTotal)}</strong></div></div>
           <div className="table-existing-items table-existing-items-side">{existingItems.length?existingItems.map(item=><KitchenItem key={item.id} item={item}/>):<div className="table-existing-empty"><Check size={20}/><span>Todavía no hay productos comandados.</span></div>}</div>
           {tab&&currentTotal>0&&<div className="table-account-actions">
             <button className="table-charge-button" disabled={cart.length>0} title={cart.length?'Primero agrega los productos nuevos a la cuenta.':'Cobrar cuenta'} onClick={()=>setPaymentOpen(true)}><Banknote size={19}/> Cobrar cuenta · ${money(currentTotal)}</button>
             <button className="table-prebill-button" disabled={cart.length>0} title={cart.length?'Primero agrega los productos nuevos a la cuenta.':'Imprimir cuenta para cobrar'} aria-label="Imprimir cuenta para cobrar" onClick={()=>printTablePreBill(tab)}><Printer size={20}/></button>
           </div>}
         </section>
       </aside>
     </div>
   </section>
   {configProduct&&<ProductConfiguratorModal product={configProduct} bases={bases} guisados={guisados} extras={extras} onClose={()=>setConfigProduct(null)} onAdd={row=>setCart(prev=>[...prev,row])} contextLabel="nueva comanda"/>}
   {paymentOpen&&tab&&<TablePaymentModal tab={tab} onClose={()=>setPaymentOpen(false)} onConfirmed={()=>{setPaymentOpen(false);onPaid()}}/>}
 </div>
}

function Counter({label,n}){return <div><span>{label}</span><b>{n}</b></div>}

function OrderLane({title,subtitle,count,tone,children}){
 return <section className={`order-lane ${tone}`}><div className="lane-head"><div><span>{title}</span><small>{subtitle}</small></div><b>{count}</b></div><div className="lane-list">{children}</div></section>
}

function LaneEmpty({icon,title,text}){return <div className="lane-empty">{icon}<h3>{title}</h3><p>{text}</p></div>}

function Ticket({order,onAcknowledge,onDetails,onAdvance}){
 const acknowledged=Boolean(order.kitchen_acknowledged_at)
 const isReady=order.status==='Listo'
 return <article className={`ticket compact-ticket ${order.status.toLowerCase()} ${acknowledged?'acknowledged':'unacknowledged'}`}>
   <div className="ticket-top compact-ticket-top"><div><span>{order.order_number}</span><b>{order.customer_name}</b></div></div>

   <div className="compact-ticket-actions">
     <button className={`acknowledge ${acknowledged?'done':''}`} disabled={acknowledged} onClick={onAcknowledge}><Check size={17}/> Enterado</button>
     <button className="details-button" onClick={onDetails}><Eye size={17}/> Ver detalles</button>
   </div>

   <div className="compact-ticket-print-actions">
     <button onClick={()=>printOrderPreBill(order)}><Printer size={17}/> Ticket por cobrar</button>
     <button onClick={()=>printKitchenTicket(order)}><Printer size={17}/> Ticket cocina</button>
   </div>

   <button className={`compact-ticket-advance ${isReady?'deliver':''}`} onClick={onAdvance}>
     {isReady?<Check size={18}/>:<Flame size={18}/>} {isReady?'Entregar pedido':'Marcar listo'}
   </button>
 </article>
}

function OrderDetailsModal({order,onClose,onAcknowledge,onAdvance}){
 const acknowledged=Boolean(order.kitchen_acknowledged_at)
 const subtotal=orderSubtotal(order)
 return <div className="order-detail-overlay" onMouseDown={onClose}>
   <section className="order-detail-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>PEDIDO {order.order_number}</span><h2>{order.customer_name}</h2><p>{displayPickupLabel(order.pickup_label)} · {order.customer_phone||'Sin teléfono'}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
     <div className="order-detail-body">
       <div className="order-detail-meta"><div><span>Estado</span><b>{order.status}</b></div><div><span>Pago</span><b>{paymentLabel(order)} · {paymentStatusLabel(order)}</b></div><div><span>Recibido</span><b>{thermalDate(order.created_at)}</b></div></div>
       <section><h3>Productos</h3><div className="detail-items">{(order.order_items||[]).map(i=><KitchenItem item={i} key={i.id}/>)}</div></section>
       <section className="order-financial-detail"><h3>Desglose</h3><div><span>Subtotal</span><b>{thermalMoney(subtotal)}</b></div>{Number(order.rain_delivery_fee||0)>0&&<div><span>Envío con lluvia</span><b>+{thermalMoney(order.rain_delivery_fee)}</b></div>}{Number(order.first_order_discount||0)>0&&<div className="discount"><span>Regalo primer pedido</span><b>−{thermalMoney(order.first_order_discount)}</b></div>}{Number(order.cashback_used||0)>0&&<div className="discount"><span>Cashback</span><b>−{thermalMoney(order.cashback_used)}</b></div>}<div className="total"><span>Total</span><b>{thermalMoney(order.total)}</b></div></section>
     </div>
     <footer>
       {!acknowledged&&<button className="acknowledge-detail" onClick={onAcknowledge}><Check size={17}/> Enterado</button>}
       <button onClick={()=>printKitchenTicket(order)}><Printer size={17}/> Ticket cocina</button>
       <button onClick={()=>printOrderPreBill(order)}><Printer size={17}/> Ticket por cobrar</button>
       <button className="advance-detail" onClick={onAdvance}>{order.status==='Listo'?<Check size={17}/>:<Flame size={17}/>} {order.status==='Listo'?'Entregar pedido':'Marcar como listo'}</button>
     </footer>
   </section>
 </div>
}

function ScheduledOrdersModal({orders,now,onClose}){
 return <div className="scheduled-orders-overlay" onMouseDown={onClose}>
   <section className="scheduled-orders-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>PEDIDOS PROGRAMADOS</span><h2>Próximos pickups</h2><p>Se moverán automáticamente a Preparando 15 minutos antes de la hora elegida.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
     <div className="scheduled-orders-list">
       {orders.length===0?<div className="scheduled-orders-empty"><Clock3 size={34}/><h3>No hay pedidos programados</h3><p>Los pedidos con horario futuro aparecerán aquí hasta 15 minutos antes de su pickup.</p></div>:orders.map(order=>{
         const minutes=minutesUntilPickup(order,now)
         return <article className="scheduled-order-card" key={order.id}>
           <div className="scheduled-order-time"><Clock3 size={18}/><strong>{order.pickup_label}</strong><span>{minutes>60?`en ${Math.floor(minutes/60)} h ${minutes%60} min`:`en ${Math.max(0,minutes)} min`}</span></div>
           <div className="scheduled-order-main"><div className="scheduled-order-title"><span>{order.order_number}</span><b>{order.customer_name}</b></div><p>{(order.order_items||[]).map(i=>`${i.quantity>1?`${i.quantity}× `:''}${i.name}`).join(' · ')}</p><small>{order.customer_phone||'Sin teléfono'} · ${Number(order.total||0).toFixed(2)}</small></div>
         </article>
       })}
     </div>
   </section>
 </div>
}

function KitchenItem({item}){
 const extras=(item.extras||[]).map(e=>`${e.quantity>1?`${e.quantity}× `:''}${e.name}`).join(', ')
 const guisados=Array.isArray(item.guisados)?item.guisados.join(' · '):''
 return <div className="item"><strong>{item.quantity>1?`${item.quantity} × `:''}{item.name}</strong>{item.base_name&&<span>BASE · {item.base_name}</span>}{item.variant&&<span>{item.variant}</span>}{guisados&&<p>{guisados}</p>}{extras&&<p><b>Extras:</b> {extras}</p>}</div>
}

const maxGuisadosFor=(product)=>Math.max(1,Math.min(10,Number(product?.metadata?.max_guisados||({'chi-nito-1':1,'chi-nito-2':2,'chi-nito-3':3}[product?.slug])||1)))
const money=(n)=>Number(n||0).toFixed(2)

function NewOrderModal({menu,onClose,onCreated}){
 const active=useMemo(()=>menu.filter(x=>x.active!==false),[menu])
 const products=useMemo(()=>active.filter(x=>x.category==='Chi-nito'),[active])
 const bases=useMemo(()=>active.filter(x=>x.category==='Base'),[active])
 const guisados=useMemo(()=>active.filter(x=>x.category==='Guisado'),[active])
 const extras=useMemo(()=>active.filter(x=>['Bebida','Complemento','Extra'].includes(x.category)),[active])
 const complements=useMemo(()=>active.filter(x=>x.category==='Complemento'),[active])
 const drinks=useMemo(()=>active.filter(x=>x.category==='Bebida'),[active])
 const takeaway=useMemo(()=>guisados.filter(x=>x.metadata?.sell_by_volume!==false&&(Number(x.metadata?.half_price)>0||Number(x.metadata?.liter_price)>0)),[guisados])
 const [customerName,setCustomerName]=useState('')
 const [customerPhone,setCustomerPhone]=useState('')
 const [pickup,setPickup]=useState('Lo antes posible · 10–15 min')
 const [rainDelivery,setRainDelivery]=useState(false)
 const [configProduct,setConfigProduct]=useState(null)
 const [cart,setCart]=useState([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')

 const addSimple=(item,kind,variant=null,priceOverride=null)=>{
   const unit=Number((priceOverride ?? item.price) || 0)
   setCart(prev=>[...prev,{key:`simple-${Date.now()}-${Math.random()}`,label:item.name,detail:variant||item.category,unit,payload:{kind,catalog_slug:item.slug,quantity:1,variant}}])
 }
 const changeCartQty=(key,delta)=>setCart(prev=>prev.flatMap(row=>{
   if(row.key!==key)return [row]
   const quantity=Math.max(0,Math.min(20,Number(row.payload.quantity||1)+delta))
   return quantity?[{...row,payload:{...row.payload,quantity}}]:[]
 }))
 const productsTotal=cart.reduce((s,row)=>s+row.unit*Number(row.payload.quantity||1),0)
 const total=productsTotal+(rainDelivery?30:0)
 const submit=async()=>{
   setError('')
   if(!cart.length){setError('Agrega al menos un producto al pedido.');return}
   setBusy(true)
   const {error:rpcError}=await supabase.rpc('create_staff_order',{p_customer_name:customerName,p_customer_phone:customerPhone,p_pickup_label:pickup,p_items:cart.map(row=>row.payload),p_rain_delivery:rainDelivery})
   setBusy(false)
   if(rpcError){setError(rpcError.message||'No se pudo crear el pedido.');return}
   onCreated()
 }

 return <div className="manual-order-overlay" onMouseDown={onClose}>
   <section className="manual-order-modal" onMouseDown={e=>e.stopPropagation()}>
     <header className="manual-order-head"><div><span>NUEVO PEDIDO RÁPIDO</span><h2>Captura desde cocina</h2><p>Selecciona un Chi-nito y personalízalo en una ventana independiente.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={22}/></button></header>
     <div className="manual-order-body">
       <div className="manual-order-builder">
         <section className="manual-customer"><label><UserRound size={16}/><span>Nombre del cliente</span><input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Mostrador"/></label><label><Phone size={16}/><span>Teléfono</span><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Opcional"/></label><label className="wide"><Clock3 size={16}/><span>Pickup</span><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 10–15 min</option><option>En 15 minutos</option><option>En 30 minutos</option><option>En 45 minutos</option></select></label><label className={`rain-fee-toggle wide ${rainDelivery?'active':''}`}><CloudRain size={18}/><span><b>Envío con lluvia +$30</b><small>Marca esta casilla para sumar el cargo al total y mostrarlo en el ticket de venta.</small></span><input type="checkbox" checked={rainDelivery} onChange={e=>setRainDelivery(e.target.checked)}/></label></section>
         <section className="manual-section"><div className="manual-section-title"><span>1</span><div><h3>Elige un Chi-nito</h3><p>Toca uno para abrir su personalizador.</p></div></div><div className="manual-product-grid">{products.map(p=><button key={p.slug} onClick={()=>setConfigProduct(p)}><img src={p.image||'/logo.jpg'} alt=""/><b>{p.name}</b><span>${money(p.price)}</span></button>)}</div></section>
         <section className="manual-section"><div className="manual-section-title"><span>2</span><div><h3>Complementos y bebidas</h3><p>Agrégalos directamente al pedido.</p></div></div><div className="manual-simple-grid">{[...complements,...drinks].map(item=><button key={item.slug} onClick={()=>addSimple(item,item.category==='Bebida'?'drink':'addon')}><img src={item.image||'/logo.jpg'} alt=""/><div><b>{item.name}</b><span>${money(item.price)}</span></div><Plus size={16}/></button>)}</div></section>
         {takeaway.length>0&&<section className="manual-section"><div className="manual-section-title"><span>3</span><div><h3>Guisados para llevar</h3><p>Agrega medio litro o un litro.</p></div></div><div className="manual-takeaway-grid">{takeaway.map(item=><div key={item.slug}><b>{item.name}</b><div>{Number(item.metadata?.half_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1/2 litro',item.metadata.half_price)}>1/2 L · ${money(item.metadata.half_price)}</button>}{Number(item.metadata?.liter_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1 litro',item.metadata.liter_price)}>1 L · ${money(item.metadata.liter_price)}</button>}</div></div>)}</div></section>}
       </div>
       <aside className="manual-cart"><div className="manual-cart-head"><div><span>PEDIDO</span><h3>Resumen</h3></div><b>{cart.reduce((s,r)=>s+Number(r.payload.quantity||1),0)}</b></div><div className="manual-cart-items">{cart.length===0?<div className="manual-cart-empty"><ShoppingBag size={30}/><p>Agrega productos para comenzar.</p></div>:cart.map(row=><div className="manual-cart-row" key={row.key}><div><b>{row.label}</b><span>{row.detail}</span><strong>${money(row.unit*Number(row.payload.quantity||1))}</strong></div><div className="manual-cart-qty"><button onClick={()=>changeCartQty(row.key,-1)}><Minus size={13}/></button><b>{row.payload.quantity||1}</b><button onClick={()=>changeCartQty(row.key,1)}><Plus size={13}/></button></div></div>)}</div><div className="manual-cart-total"><span>Total</span><strong>${money(total)}</strong></div>{error&&<p className="manual-order-error">{error}</p>}<button className="manual-submit" disabled={busy||!cart.length} onClick={submit}>{busy?'Creando pedido…':<>Enviar a Preparando <Flame size={17}/></>}</button></aside>
     </div>
   </section>
   {configProduct&&<ProductConfiguratorModal product={configProduct} bases={bases} guisados={guisados} extras={extras} onClose={()=>setConfigProduct(null)} onAdd={row=>setCart(prev=>[...prev,row])} contextLabel="pedido"/>}
 </div>
}

function KitchenLogin({error}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState(error||'')
 useEffect(()=>setMessage(error||''),[error])
 const login=async(e)=>{e.preventDefault();setBusy(true);setMessage('');const {error:loginError}=await supabase.auth.signInWithPassword({email,password});if(loginError)setMessage(loginError.message);setBusy(false)}
 return <div className="k-auth"><form className="k-auth-card" onSubmit={login}><img src="/logo.jpg" alt="Chi-nito"/><span className="eyebrow">ACCESO DE PERSONAL</span><h1>Kitchen Mode</h1><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p className="k-auth-error">{message}</p>}<button disabled={busy}>{busy?'Entrando…':'Entrar a cocina'}</button></form></div>
}
function SetupMissing(){return <div className="k-auth"><div className="k-auth-card"><img src="/logo.jpg" alt="Chi-nito"/><h1>Kitchen Mode</h1><p>Faltan <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en Vercel.</p></div></div>}
