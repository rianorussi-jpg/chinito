import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Clock3, CreditCard, Minus, Plus, ShoppingBag, Trash2, UserRound, X } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const BASES = [
  { id:'frito', slug:'base-arroz-frito', name:'Arroz frito', image:'/img/product/arroz-frito.jpg' },
  { id:'chowmein', slug:'base-chow-mein', name:'Chow mein', image:'/img/product/chow-mein.jpg' },
]
const GUISADOS = [
  { id:'orange-chicken', slug:'orange-chicken', name:'ORANGE CHICKEN', image:'/img/product/orange-chicken.jpg' },
  { id:'bbq-pork', slug:'bbq-pork', name:'BBQ PORK', image:'/img/product/bbq-pork.jpg' },
  { id:'res-cantonesa', slug:'res-cantonesa', name:'RES CANTONESA', image:'/img/product/res-cantonesa.jpg' },
  { id:'sweet-sour-chicken', slug:'sweet-sour-chicken', name:'SWEET & SOUR CHICKEN', image:'/img/product/sweet-sour-chicken.jpg' },
  { id:'sweet-sour-pork', slug:'sweet-sour-pork', name:'SWEET & SOUR PORK', image:'/img/product/sweet-sour-pork.jpg' },
  { id:'camaron-agridulce', slug:'camaron-agridulce', name:'CAMARÓN AGRIDULCE', image:'/img/product/camaron-agridulce.jpg' },
  { id:'kung-pao-chicken', slug:'kung-pao-chicken', name:'KUNG PAO CHICKEN', image:'/img/product/kung-pao-chicken.jpg' },
  { id:'beef-broccoli', slug:'beef-broccoli', name:'BEEF & BROCCOLI', image:'/img/product/beef-broccoli.jpg' },
  { id:'veggie-wok', slug:'veggie-wok', name:'VEGGIE WOK', image:'/img/product/veggie-wok.jpg' },
]
const PRODUCTOS = [
  { id:1, slug:'chi-nito-1', name:'Chi-nito 1', baseCount:1, guisados:1, price:95, desc:'Ideal para un antojo rápido.', image:'/img/product/chi-nito-1.jpg' },
  { id:2, slug:'chi-nito-2', name:'Chi-nito 2', baseCount:1, guisados:2, price:115, desc:'El balance perfecto para comer bien.', image:'/img/product/chi-nito-2.jpg' },
  { id:3, slug:'chi-nito-3', name:'Chi-nito 3', baseCount:1, guisados:3, price:135, desc:'El máximo de sabor en un solo bowl.', image:'/img/product/chi-nito-3.jpg' },
]
const EXTRAS = [
  { id:'te-helado', type:'Bebidas', name:'Té helado', price:35, image:'/img/product/te-helado.jpg' },
  { id:'coca-cola', type:'Bebidas', name:'Coca-Cola', price:30, image:'/img/product/coca-cola.jpg' },
  { id:'coca-cola-zero', type:'Bebidas', name:'Coca-Cola Zero', price:30, image:'/img/product/coca-cola-zero.jpg' },
  { id:'sprite', type:'Bebidas', name:'Sprite', price:30, image:'/img/product/sprite.jpg' },
  { id:'fanta', type:'Bebidas', name:'Fanta', price:30, image:'/img/product/fanta.jpg' },
  { id:'manzanita', type:'Bebidas', name:'Manzanita', price:30, image:'/img/product/manzanita.jpg' },
  { id:'agua', type:'Bebidas', name:'Agua', price:25, image:'/img/product/agua.jpg' },
  { id:'chinito-bites', type:'Complementos', name:'CHI•NITO BITES', price:59, image:'/img/product/chinito-bites.jpg' },
  { id:'edamames-al-wok', type:'Complementos', name:'EDAMAMES AL WOK', price:59, image:'/img/product/edamames-al-wok.jpg' },
  { id:'dumplings', type:'Complementos', name:'DUMPLINGS', price:59, image:'/img/product/dumplings.jpg' },
  { id:'wok-fries', type:'Complementos', name:'WOK FRIES', price:59, image:'/img/product/wok-fries.jpg' },
  { id:'spring-rolls', type:'Complementos', name:'SPRING ROLLS', price:59, image:'/img/product/spring-rolls.jpg' },
  { id:'extra-arroz', type:'Extras', name:'Extra arroz', weight:'125 g', price:25, image:'/img/product/arroz-frito.jpg' },
  { id:'extra-chow-mein', type:'Extras', name:'Extra chow mein', weight:'125 g', price:25, image:'/img/product/chow-mein.jpg' },
  { id:'extra-orange-chicken', type:'Extras', name:'Extra ORANGE CHICKEN', weight:'125 g', price:39, image:'/img/product/orange-chicken.jpg' },
  { id:'extra-bbq-pork', type:'Extras', name:'Extra BBQ PORK', weight:'125 g', price:39, image:'/img/product/bbq-pork.jpg' },
  { id:'extra-res-cantonesa', type:'Extras', name:'Extra RES CANTONESA', weight:'125 g', price:39, image:'/img/product/res-cantonesa.jpg' },
  { id:'extra-sweet-sour-chicken', type:'Extras', name:'Extra SWEET & SOUR CHICKEN', weight:'125 g', price:39, image:'/img/product/sweet-sour-chicken.jpg' },
  { id:'extra-sweet-sour-pork', type:'Extras', name:'Extra SWEET & SOUR PORK', weight:'125 g', price:39, image:'/img/product/sweet-sour-pork.jpg' },
  { id:'extra-camaron-agridulce', type:'Extras', name:'Extra CAMARÓN AGRIDULCE', weight:'125 g', price:39, image:'/img/product/camaron-agridulce.jpg' },
  { id:'extra-kung-pao-chicken', type:'Extras', name:'Extra KUNG PAO CHICKEN', weight:'125 g', price:39, image:'/img/product/kung-pao-chicken.jpg' },
  { id:'extra-beef-broccoli', type:'Extras', name:'Extra BEEF & BROCCOLI', weight:'125 g', price:39, image:'/img/product/beef-broccoli.jpg' },
  { id:'extra-veggie-wok', type:'Extras', name:'Extra VEGGIE WOK', weight:'125 g', price:39, image:'/img/product/veggie-wok.jpg' },
]

const COMPLEMENTOS_HOME = [
  { id:'chinito-bites-home', catalogSlug:'chinito-bites', name:'CHI•NITO BITES', price:59, image:'/img/product/chinito-bites.jpg', desc:'140 g · Bocados de pollo crujiente con salsa Sweet Chili, ajonjolí y cebollín.' },
  { id:'edamames-home', catalogSlug:'edamames-al-wok', name:'EDAMAMES AL WOK', price:59, image:'/img/product/edamames-al-wok.jpg', desc:'120 g · Edamames salteados con soya, chile, ajonjolí y cebollín.' },
  { id:'dumplings-home', catalogSlug:'dumplings', name:'DUMPLINGS', price:59, image:'/img/product/dumplings.jpg', desc:'4 piezas · 120 g · Dumplings de cerdo y vegetales, dorados al wok.' },
  { id:'wok-fries-home', catalogSlug:'wok-fries', name:'WOK FRIES', price:59, image:'/img/product/wok-fries.jpg', desc:'140 g · Papas crujientes terminadas al wok con salsa dulce-picante, ajo, ajonjolí y cebollín.' },
  { id:'spring-rolls-home', catalogSlug:'spring-rolls', name:'SPRING ROLLS', price:59, image:'/img/product/spring-rolls.jpg', desc:'3 piezas · 120 g · Rollitos primavera dorados y crujientes.' },
]

const BEBIDAS_HOME = [
  { id:'te-casa-home', catalogSlug:'te-casa', name:'Té de la casa', price:35, image:'/img/product/te-casa.jpg', mode:'qty' },
  { id:'refresco-home', catalogSlug:'coca-cola', name:'Refresco', price:30, image:'/img/product/refresco.jpg', mode:'choose' },
  { id:'agua-home', catalogSlug:'agua', name:'Botella de agua', price:25, image:'/img/product/botella-agua.jpg', mode:'qty' },
]

const REFRESCO_SABORES = [
  {name:'Coca-Cola',slug:'coca-cola',image:'/img/product/coca-cola.jpg'},
  {name:'Coca-Cola Zero',slug:'coca-cola-zero',image:'/img/product/coca-cola-zero.jpg'},
  {name:'Sprite',slug:'sprite',image:'/img/product/sprite.jpg'},
  {name:'Fanta',slug:'fanta',image:'/img/product/fanta.jpg'},
  {name:'Manzanita',slug:'manzanita',image:'/img/product/manzanita.jpg'},
]

const GUISADOS_PARA_LLEVAR = GUISADOS.map((g,index)=>({
  ...g,
  halfPrice:[95,110,115,100,110,145,100,115,85][index],
  literPrice:[175,205,215,185,205,275,185,215,155][index],
  description:[
    'Pollo crujiente en salsa de naranja, ajo, jengibre, ajonjolí y cebollín.',
    'Cerdo estilo chino-americano, glaseado con nuestra salsa BBQ y ligeramente caramelizado.',
    'Res ligeramente crujiente con cebolla, pimientos, zanahoria y cebollín en salsa cantonesa oscura, brillante y dulce-salada.',
    'Pollo crujiente con pimientos, cebolla y piña en salsa agridulce.',
    'Cerdo crujiente con pimientos, cebolla y piña en salsa agridulce.',
    'Camarones crujientes estilo bombochito, pimientos, cebolla y piña en salsa agridulce.',
    'Pollo, vegetales, cacahuate, chile seco y salsa Kung Pao.',
    'Res salteada con brócoli, zanahoria y cebolla en salsa de soya y ostión.',
    'Brócoli, col, zanahoria, pimientos, cebolla, calabaza y ejotes salteados al wok.',
  ][index],
}))


const volumeEnabled=(r)=>r?.metadata?.sell_by_volume!==false&&Number(r?.metadata?.half_price)>0&&Number(r?.metadata?.liter_price)>0
const createCatalogItem=(r)=>({id:r.slug,slug:r.slug,name:r.name,image:r.image||'/img/product/chi-nito-1.jpg',price:Number(r.price),description:r.description||'',active:r.active,metadata:r.metadata||{}})
function buildClientMenu(rows){
  if(!rows)return {products:PRODUCTOS,bases:BASES,guisados:GUISADOS,extras:EXTRAS,complements:COMPLEMENTOS_HOME,takeaway:GUISADOS_PARA_LLEVAR,drinks:BEBIDAS_HOME,flavors:REFRESCO_SABORES}
  const grouped=(category)=>rows.filter(r=>r.category===category).map(createCatalogItem)
  const products=grouped('Chi-nito').map(r=>({
    ...r,baseCount:1,guisados:Math.max(1,Math.min(3,Number(r.metadata?.max_guisados||({'chi-nito-1':1,'chi-nito-2':2,'chi-nito-3':3}[r.slug])||1))),desc:r.description,
  }))
  const bases=grouped('Base')
  const guisados=grouped('Guisado')
  const extras=rows.filter(r=>['Bebida','Complemento','Extra'].includes(r.category)).map(r=>({
    ...createCatalogItem(r),type:{Bebida:'Bebidas',Complemento:'Complementos',Extra:'Extras'}[r.category],weight:r.category==='Extra'?(r.metadata?.weight||'125 g'):'',
  }))
  const complements=grouped('Complemento').map(r=>({...r,id:`${r.slug}-home`,catalogSlug:r.slug,desc:r.description}))
  const takeaway=grouped('Guisado').filter(r=>volumeEnabled(r)).map(r=>({...r,halfPrice:Number(r.metadata.half_price),literPrice:Number(r.metadata.liter_price)}))
  const coreFlavors=['coca-cola','coca-cola-zero','sprite','fanta','manzanita']
  const flavors=grouped('Bebida').filter(r=>coreFlavors.includes(r.slug)).map(r=>({slug:r.slug,name:r.name,image:r.image}))
  const drinks=grouped('Bebida').filter(r=>!coreFlavors.includes(r.slug)).map(r=>({...r,id:`${r.slug}-home`,catalogSlug:r.slug,mode:'qty'}))
  if(flavors.length) drinks.splice(Math.min(1,drinks.length),0,{id:'refresco-home',catalogSlug:flavors[0].slug,name:'Refresco',image:'/img/product/refresco.jpg',price:Number(rows.find(r=>r.slug===flavors[0].slug)?.price||30),mode:'choose'})
  return {products,bases,guisados,extras,complements,takeaway,drinks,flavors}
}

const itemUnitPrice=(item)=> item.kind==='configured'
  ? Number(item.product.price)+Number(item.base?.price||0)+item.guisados.reduce((s,g)=>s+Number(g.price||0),0)+item.extras.reduce((s,e)=>s+(Number(e.price)*(e.quantity || 1)),0)
  : item.price

const formatExtras = (extras=[]) => extras.map(e => `${e.quantity && e.quantity > 1 ? `${e.quantity}x ` : ''}${e.name}`).join(', ')

function App(){
  const [screen,setScreen]=useState('home')
  const [product,setProduct]=useState(PRODUCTOS[2])
  const [base,setBase]=useState(BASES[0])
  const [guisados,setGuisados]=useState([GUISADOS[1]])
  const [tab,setTab]=useState('Bebidas')
  const [extrasQty,setExtrasQty]=useState({})
  const [cartOpen,setCartOpen]=useState(false)
  const [profileOpen,setProfileOpen]=useState(false)
  const [isLoggedIn,setIsLoggedIn]=useState(false)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [cartItems,setCartItems]=useState([])
  const [name,setName]=useState('')
  const [phone,setPhone]=useState('')
  const [pickup,setPickup]=useState('Lo antes posible · 20–30 min')
  const [payment,setPayment]=useState('online')
  const [placed,setPlaced]=useState(false)
  const [lastOrder,setLastOrder]=useState(null)
  const [placing,setPlacing]=useState(false)
  const [placeError,setPlaceError]=useState('')
  const [catalog,setCatalog]=useState({})
  const [catalogRows,setCatalogRows]=useState(null)
  const [storeSettings,setStoreSettings]=useState(null)

  useEffect(()=>{
    if(!supabase) return
    let active=true
    const loadCatalog=async()=>{
      const [{data:menu},{data:settings}]=await Promise.all([
        supabase.from('menu_items').select('*').order('sort_order',{ascending:true}),
        supabase.from('store_settings').select('*').eq('id',1).maybeSingle(),
      ])
      if(!active) return
      if(menu){ setCatalog(Object.fromEntries(menu.map(item=>[item.slug,item])));setCatalogRows(menu) }
      if(settings) setStoreSettings(settings)
    }
    loadCatalog()
    const channel=supabase.channel('cliente-menu-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},loadCatalog)
      .on('postgres_changes',{event:'*',schema:'public',table:'store_settings'},loadCatalog)
      .subscribe()
    return ()=>{active=false;supabase.removeChannel(channel)}
  },[])

  const clientMenu=useMemo(()=>buildClientMenu(catalogRows),[catalogRows])
  const isAvailable=(slug)=>catalog[slug]?.active !== false
  const priceFor=(slug,fallback)=>Number(catalog[slug]?.price ?? fallback)

  const addProduct=(p)=>{
    if(!isAvailable(p.slug)) return
    setProduct({...p,price:priceFor(p.slug,p.price)})
    setBase(clientMenu.bases.find(b=>isAvailable(b.slug))||null)
    setGuisados([])
    setExtrasQty({})
    setScreen('builder')
    window.scrollTo(0,0)
  }
  const toggleGuisado=(g)=>{
    if(!isAvailable(g.slug||g.id)) return
    setGuisados(prev => prev.some(x=>x.id===g.id) ? prev.filter(x=>x.id!==g.id) : prev.length<product.guisados ? [...prev,g] : prev)
  }
  const changeExtraQty=(entry,delta)=>{
    setExtrasQty(prev=>{
      const current = prev[entry.id]?.quantity || 0
      const next = Math.min(50,current + delta)
      if(next <= 0){
        const clone = {...prev}
        delete clone[entry.id]
        return clone
      }
      return {...prev,[entry.id]:{...entry,quantity:next}}
    })
  }
  useEffect(()=>{
    if(!catalogRows)return
    setProduct(prev=>clientMenu.products.find(x=>x.slug===prev.slug)||prev)
    setBase(prev=>prev?clientMenu.bases.find(x=>x.slug===prev.slug)||null:null)
    setGuisados(prev=>prev.map(g=>clientMenu.guisados.find(x=>x.slug===g.slug)).filter(Boolean))
    setExtrasQty(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>clientMenu.extras.some(x=>x.id===id)).map(([id,old])=>[id,{...clientMenu.extras.find(x=>x.id===id),quantity:old.quantity}])))
  },[clientMenu,catalogRows])
  const ready=base && guisados.length>=1 && isAvailable(product.slug) && isAvailable(base.slug) && guisados.every(g=>isAvailable(g.slug||g.id))

  const addConfiguredToCart=()=>{
    if(!ready) return
    const selectedExtras = Object.values(extrasQty).filter(extra=>isAvailable(extra.id)).map(extra=>({...extra,price:priceFor(extra.id,extra.price),catalogSlug:extra.id}))
    const item={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      kind:'configured',
      product:{...product,price:priceFor(product.slug,product.price)},
      base,
      guisados:[...guisados],
      extras:selectedExtras,
      quantity:1,
    }
    setCartItems(prev=>[...prev,item])
    setScreen('home')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const addSimpleItem=(entry)=>{
    const catalogSlug=entry.catalogSlug || entry.refId.replace(/-home$/,'')
    if(!isAvailable(catalogSlug)) return
    entry={...entry,catalogSlug,price:priceFor(catalogSlug,entry.price)}
    const key=`${entry.kind}-${entry.refId}-${entry.variant || ''}`
    setCartItems(prev=>{
      const existing=prev.find(item=>item.cartKey===key)
      if(existing) return prev.map(item=>item.cartKey===key?{...item,quantity:Math.min(50,item.quantity+1)}:item)
      return [...prev,{...entry,id:`${key}-${Date.now()}`,cartKey:key,quantity:1}]
    })
  }
  const removeSimpleItem=(kind,refId,variant='')=>{
    const key=`${kind}-${refId}-${variant}`
    setCartItems(prev=>prev.flatMap(item=>{
      if(item.cartKey!==key) return [item]
      if(item.quantity<=1) return []
      return [{...item,quantity:item.quantity-1}]
    }))
  }
  const getCartQty=(kind,refId,variant='')=>cartItems.find(item=>item.cartKey===`${kind}-${refId}-${variant}`)?.quantity || 0
  const removeCartItem=(id)=>setCartItems(prev=>prev.filter(item=>item.id!==id))
  const changeCartQty=(id,delta)=>setCartItems(prev=>prev.flatMap(item=>{
    if(item.id!==id) return [item]
    const next=Math.min(50,item.quantity+delta)
    return next<=0?[]:[{...item,quantity:next}]
  }))
  const placeOrder=async()=>{
    setPlaceError('')
    if(!supabaseConfigured || !supabase){setPlaceError('Falta conectar Supabase en Vercel.');return}
    if(storeSettings && (!storeSettings.store_open || !storeSettings.pickup_enabled)){setPlaceError('La tienda no está recibiendo pedidos en este momento.');return}
    if(!cartItems.length || !name.trim() || !phone.trim()) return
    setPlacing(true)
    const payload=cartItems.map(item=>{
      if(item.kind==='configured') return {
        kind:'configured',
        catalog_slug:item.product.slug,
        quantity:item.quantity,
        base_slug:item.base.slug,
        guisado_slugs:item.guisados.map(g=>g.slug||g.id),
        extras:item.extras.map(e=>({catalog_slug:e.catalogSlug||e.id,quantity:e.quantity||1})),
      }
      return {
        kind:item.kind,
        catalog_slug:item.catalogSlug || item.refId?.replace(/-home$/,''),
        quantity:item.quantity,
        variant:item.variant || null,
      }
    })
    const {data,error}=await supabase.rpc('create_customer_order',{
      p_customer_name:name.trim(),
      p_customer_phone:phone.trim(),
      p_pickup_label:pickup,
      p_payment_method:payment,
      p_items:payload,
    })
    setPlacing(false)
    if(error){setPlaceError(error.message || 'No pudimos crear el pedido.');return}
    const created=Array.isArray(data)?data[0]:data
    setLastOrder(created)
    setPlaced(true)
  }

  const displayCart=useMemo(()=>cartItems.map(item=>{
    if(item.kind==='configured') return {...item,product:{...item.product,...(catalog[item.product.slug]||{}),price:priceFor(item.product.slug,item.product.price)},base:{...item.base,price:priceFor(item.base.slug,item.base.price||0)},guisados:item.guisados.map(g=>({...g,price:priceFor(g.slug,g.price||0)})),extras:item.extras.map(e=>({...e,name:catalog[e.catalogSlug||e.id]?.name||e.name,image:catalog[e.catalogSlug||e.id]?.image||e.image,price:priceFor(e.catalogSlug||e.id,e.price)}))}
    const row=catalog[item.catalogSlug]
    if(!row)return item
    const catalogPrice=item.kind==='takeaway'?(item.variant==='1 litro'?Number(row.metadata?.liter_price||0):Number(row.metadata?.half_price||0)):Number(row.price)
    return {...item,name:row.name,image:row.image||item.image,price:catalogPrice}
  }),[cartItems,catalog])
  const cartCount=cartItems.reduce((sum,item)=>sum+item.quantity,0)
  const cartTotal=useMemo(()=>displayCart.reduce((sum,item)=>sum+(itemUnitPrice(item)*item.quantity),0),[displayCart])

  if(placed) return <Success order={lastOrder} onReset={()=>{setPlaced(false);setLastOrder(null);setScreen('home');setCartItems([])}} />

  return <div className="app-shell">
    {screen!=='builder' && screen!=='cart' && <header className="topbar">
      <button className="icon-btn profile-btn" onClick={()=>setProfileOpen(true)} aria-label="Ver perfil"><UserRound size={23}/></button>
      <div className="brand-mini" onClick={()=>setScreen('home')}><img src="/logo.jpg" alt="Chi-nito"/></div>
      <div className="topbar-spacer" aria-hidden="true" />
    </header>}

    {screen==='home' && <>
      <Home onPick={addProduct} onAddSimple={addSimpleItem} onRemoveSimple={removeSimpleItem} getCartQty={getCartQty} catalog={catalog} menuData={clientMenu} />
      {cartCount>0 && <button className="home-cart-float" onClick={()=>setCartOpen(true)}><ShoppingBag size={19}/><span>Ver carrito</span><b>{cartCount}</b></button>}
      {cartOpen && <CartSheet items={displayCart} total={cartTotal} onClose={()=>setCartOpen(false)} onChangeQty={changeCartQty} onRemove={removeCartItem} onContinue={()=>{setCartOpen(false);setScreen('cart');window.scrollTo(0,0)}} />}
    </>}
    {screen==='builder' && <Builder product={product} base={base} setBase={setBase} guisados={guisados} toggleGuisado={toggleGuisado} tab={tab} setTab={setTab} extrasQty={extrasQty} changeExtraQty={changeExtraQty} ready={ready} catalog={catalog} menuData={clientMenu} onBack={()=>setScreen('home')} onAdd={addConfiguredToCart} />}
    {screen==='cart' && <Cart items={displayCart} total={cartTotal} pickup={pickup} setPickup={setPickup} name={name} setName={setName} phone={phone} setPhone={setPhone} payment={payment} setPayment={setPayment} onBack={()=>setScreen('home')} onPlace={placeOrder} placing={placing} placeError={placeError} />}

    {profileOpen && <ProfileDrawer
      isLoggedIn={isLoggedIn}
      setIsLoggedIn={setIsLoggedIn}
      name={name}
      setName={setName}
      phone={phone}
      setPhone={setPhone}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onClose={()=>setProfileOpen(false)}
    />}
  </div>
}

function ProfileDrawer({isLoggedIn,setIsLoggedIn,name,setName,phone,setPhone,email,setEmail,password,setPassword,onClose}){
  const login=()=>{
    if(!email.trim()) return
    if(!name.trim()) setName(email.split('@')[0] || 'Cliente')
    setIsLoggedIn(true)
  }
  return <div className="profile-drawer-overlay" onClick={onClose} role="presentation">
    <aside className="profile-drawer" onClick={e=>e.stopPropagation()} aria-label="Cuenta y perfil">
      <div className="profile-drawer-head">
        <div><small>MI CUENTA</small><h2>{isLoggedIn?'Tu perfil':'Bienvenido'}</h2></div>
        <button className="profile-drawer-close" onClick={onClose} aria-label="Cerrar"><X size={22}/></button>
      </div>

      {isLoggedIn ? <>
        <div className="profile-drawer-user">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <div><b>{name || 'Cliente Chi-nito'}</b><span>{email || 'Sesión iniciada'}</span></div>
        </div>
        <div className="profile-drawer-fields">
          <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" /></label>
          <label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Tu teléfono" inputMode="tel" /></label>
          <label>Correo electrónico<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" inputMode="email" /></label>
        </div>
        <button className="primary profile-drawer-save" onClick={onClose}>Guardar cambios</button>
        <button className="profile-drawer-logout" onClick={()=>setIsLoggedIn(false)}>Cerrar sesión</button>
      </> : <>
        <div className="profile-drawer-intro">
          <div className="profile-drawer-avatar"><UserRound size={30}/></div>
          <p>Inicia sesión para guardar tus datos y agilizar tus pedidos de pickup.</p>
        </div>
        <div className="profile-drawer-fields">
          <label>Correo electrónico<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" inputMode="email" /></label>
          <label>Contraseña<input value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" type="password" /></label>
        </div>
        <button className="primary profile-drawer-save" onClick={login}>Iniciar sesión</button>
        <button className="profile-drawer-link" type="button">Crear una cuenta</button>
        <p className="profile-drawer-note">También puedes hacer tu pedido sin iniciar sesión.</p>
      </>}
    </aside>
  </div>
}

function Home({onPick,onAddSimple,onRemoveSimple,getCartQty,catalog,menuData}){
  const {products:PRODUCTOS,complements:COMPLEMENTOS_HOME,takeaway:GUISADOS_PARA_LLEVAR,drinks:BEBIDAS_HOME,flavors:REFRESCO_SABORES}=menuData
  const [takeawaySize,setTakeawaySize]=useState('half')
  const [sodaOpen,setSodaOpen]=useState(false)
  const goToMenu=()=>document.getElementById('menu-chinito')?.scrollIntoView({behavior:'smooth',block:'start'})
  const variant=takeawaySize==='half'?'1/2 litro':'1 litro'
  const available=(slug)=>catalog[slug]?.active !== false
  const price=(slug,fallback)=>Number(catalog[slug]?.price ?? fallback)
  const takeawayPrice=(item)=>{
    const meta=catalog[item.slug]?.metadata || {}
    return takeawaySize==='half' ? Number(meta.half_price ?? item.halfPrice) : Number(meta.liter_price ?? item.literPrice)
  }
  return <main>
    <section className="home-hero-image" onClick={goToMenu} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' ') goToMenu()}} aria-label="Ver menú de Chi-nito">
      <img src="/img/inicio.jpg" alt="Arma tu Chi-nito - Solo pickup" />
    </section>

    <section className="section-wrap" id="menu-chinito">
      <div className="section-head"><div><h2>Nuestros Chi-nitos</h2></div><span className="muted">1 base + tus guisados favoritos</span></div>
      <div className="product-grid">{PRODUCTOS.map((p)=>{const ok=available(p.slug);const pPrice=price(p.slug,p.price);return <article className={`product-card ${ok?'':'soldout-card'}`} key={p.id}>
        <div className="product-visual"><img src={p.image} alt={p.name}/></div>
        <div className="badge">{ok?`${p.guisados} guisado${p.guisados>1?'s':''}`:'Agotado'}</div>
        <h3>{p.name}</h3><p>1 base + {p.guisados} guisado{p.guisados>1?'s':''}</p><small>{p.desc}</small>
        <div className="product-foot"><strong>Desde ${pPrice}</strong><button disabled={!ok} onClick={()=>onPick({...p,price:pPrice})}>{ok?'Elegir':'Agotado'}</button></div>
      </article>})}</div>
    </section>

    <section className="home-scroll-section complements-section">
      <div className="home-scroll-head"><h2>Complementos</h2><span>Desliza para ver más</span></div>
      <div className="home-card-scroller">
        {COMPLEMENTOS_HOME.map(item=>{
          const qty=getCartQty('addon',item.id)
          const ok=available(item.catalogSlug)
          const itemPrice=price(item.catalogSlug,item.price)
          return <article className={`home-add-card ${ok?'':'soldout-card'}`} key={item.id}>
            <div className="home-add-visual"><img src={item.image} alt={item.name}/></div>
            <div className="home-add-copy"><h3>{item.name}</h3>{item.desc&&<p>{item.desc}</p>}</div>
            <div className="home-add-actions">
              <strong className="home-add-price">${itemPrice}</strong>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('addon',item.id)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button disabled={!ok} onClick={()=>onAddSimple({kind:'addon',refId:item.id,catalogSlug:item.catalogSlug,name:item.name,image:item.image,price:itemPrice})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
              </div>
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="home-scroll-section takeaway-section">
      <div className="home-scroll-head takeaway-head">
        <div><h2>Guisados para llevar</h2><span>Elige el tamaño y desliza para ver más</span></div>
        <div className="size-switch" aria-label="Tamaño de guisado">
          <button className={takeawaySize==='half'?'active':''} onClick={()=>setTakeawaySize('half')}>1/2 litro</button>
          <button className={takeawaySize==='liter'?'active':''} onClick={()=>setTakeawaySize('liter')}>1 litro</button>
        </div>
      </div>
      <div className="home-card-scroller">
        {GUISADOS_PARA_LLEVAR.map(item=>{
          const itemPrice=takeawayPrice(item)
          const ok=available(item.slug) && itemPrice>0
          const qty=getCartQty('takeaway',item.id,variant)
          return <article className={`home-add-card ${ok?'':'soldout-card'}`} key={`${item.id}-${takeawaySize}`}>
            <div className="home-add-visual takeaway"><img src={item.image} alt={item.name}/><small>{variant}</small></div>
            <div className="home-add-copy takeaway-copy"><h3>{item.name}</h3><p>{item.description}</p></div>
            <div className="home-add-actions">
              <strong className="home-add-price">${itemPrice}</strong>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('takeaway',item.id,variant)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button disabled={!ok} onClick={()=>onAddSimple({kind:'takeaway',refId:item.id,catalogSlug:item.slug,variant,name:item.name,image:item.image,price:itemPrice})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
              </div>
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="home-scroll-section drinks-section">
      <div className="home-scroll-head"><h2>Bebidas</h2><span>Para acompañar tu pedido</span></div>
      <div className="home-card-scroller">
        {BEBIDAS_HOME.map(item=>{
          const qty=getCartQty('drink',item.id)
          const ok=item.mode==='choose'?REFRESCO_SABORES.some(f=>available(f.slug)):available(item.catalogSlug)
          const itemPrice=price(item.catalogSlug,item.price)
          return <article className={`home-add-card ${ok?'':'soldout-card'}`} key={item.id}>
            <div className="home-add-visual"><img src={item.image} alt={item.name}/></div>
            <div className="home-add-copy"><h3>{item.name}</h3></div>
            {item.mode==='choose' ? <div className="home-add-actions drink-choose-actions">
              <strong className="home-add-price">${itemPrice}</strong>
              <button disabled={!ok} className="drink-choose-btn" onClick={()=>setSodaOpen(true)}>{ok?'Elegir':'Agotado'}</button>
            </div> : <div className="home-add-actions">
              <strong className="home-add-price">${itemPrice}</strong>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('drink',item.id)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button disabled={!ok} onClick={()=>onAddSimple({kind:'drink',refId:item.id,catalogSlug:item.catalogSlug,name:item.name,image:item.image,price:itemPrice})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
              </div>
            </div>}
          </article>
        })}
      </div>
    </section>

    {sodaOpen && <div className="soda-sheet-overlay" onClick={()=>setSodaOpen(false)}>
      <section className="soda-sheet" onClick={e=>e.stopPropagation()} aria-label="Elegir sabor de refresco">
        <div className="cart-sheet-handle" />
        <div className="soda-sheet-head"><div><small>REFRESCO</small><h2>Elige el sabor</h2></div><button className="cart-sheet-close" onClick={()=>setSodaOpen(false)} aria-label="Cerrar"><X size={22}/></button></div>
        <div className="soda-flavors">
          {REFRESCO_SABORES.map(flavor=>{
            const qty=getCartQty('drink','refresco-home',flavor.name)
            const ok=available(flavor.slug)
            const flavorPrice=price(flavor.slug,30)
            return <div className={`soda-flavor-row ${ok?'':'soldout-card'}`} key={flavor.slug}>
              <div><img className="soda-product-image" src={flavor.image} alt={flavor.name}/><b>{flavor.name}</b><small>${flavorPrice}</small></div>
              <div className="inline-qty soda-qty">
                <button onClick={()=>onRemoveSimple('drink','refresco-home',flavor.name)} disabled={!qty} aria-label={`Quitar ${flavor.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button disabled={!ok} onClick={()=>onAddSimple({kind:'drink',refId:'refresco-home',catalogSlug:flavor.slug,variant:flavor.name,name:flavor.name,image:flavor.image,price:flavorPrice})} aria-label={`Agregar ${flavor.name}`}><Plus size={14}/></button>
              </div>
            </div>
          })}
        </div>
      </section>
    </div>}
  </main>
}

function Builder({product,base,setBase,guisados,toggleGuisado,tab,setTab,extrasQty,changeExtraQty,ready,onBack,onAdd,catalog,menuData}){
  const {bases:BASES,guisados:GUISADOS,extras:EXTRAS}=menuData
  const available=(slug)=>catalog[slug]?.active !== false
  const price=(slug,fallback)=>Number(catalog[slug]?.price ?? fallback)
  const guisadosSubtitle = product.guisados === 1 ? 'Selecciona 1 guisado' : `Selecciona de 1 a ${product.guisados} guisados`
  const selectedExtras = Object.values(extrasQty).filter(e=>available(e.id)).map(e=>({...e,name:catalog[e.id]?.name||e.name,image:catalog[e.id]?.image||e.image,price:price(e.id,e.price)}))
  const unitPrice=price(product.slug,product.price)+Number(base?.price||0)+guisados.reduce((sum,g)=>sum+price(g.slug,g.price||0),0)+selectedExtras.reduce((s,e)=>s+(e.price*e.quantity),0)
  const customLine=[base?.name,...guisados.map(g=>g.name)].filter(Boolean).join(' · ')
  const extrasLine=selectedExtras.length?` + ${formatExtras(selectedExtras)}`:''

  return <main className="page builder-page">
    <div className="builder-topline"><button className="builder-nav-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={22}/></button><h2>Personaliza tu Chi-nito</h2><span aria-hidden="true"></span></div>
    <section className="summary-card"><div className="summary-food"><img src={product.image} alt={product.name}/></div><div><h3>{product.name}</h3><p>1 base + {product.guisados} guisados</p><span>{product.desc}</span></div><strong>${price(product.slug,product.price)}</strong></section>

    <Step num="1" title="Elige tu base" subtitle="Selecciona una opción">
      <div className="choice-grid bases">{BASES.map(x=>{const ok=available(x.slug);return <button disabled={!ok} className={`choice ${base?.id===x.id?'selected':''} ${ok?'':'soldout-choice'}`} key={x.id} onClick={()=>setBase(x)}><img className="choice-emoji" src={x.image} alt={x.name}/><b>{x.name}</b>{!ok&&<small>Agotado</small>}{base?.id===x.id&&ok&&<i><Check size={14}/></i>}</button>})}</div>
    </Step>

    <Step num="2" title="Elige tus guisados" subtitle={guisadosSubtitle}>
      <div className="choice-grid guisos">{GUISADOS.map(x=>{const selected=guisados.some(g=>g.id===x.id);const ok=available(x.slug); return <button disabled={!ok} className={`choice ${selected?'selected':''} ${ok?'':'soldout-choice'}`} key={x.id} onClick={()=>toggleGuisado(x)}><img className="choice-emoji" src={x.image} alt={x.name}/><b>{x.name}</b>{!ok&&<small>Agotado</small>}{selected&&ok&&<i><Check size={14}/></i>}</button>})}</div>
    </Step>

    <Step title="Agrega más a tu orden" subtitle="Opcional">
      <div className="tabs">{['Bebidas','Complementos','Extras'].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t}</button>)}</div>
      <div className="extras-grid">{EXTRAS.filter(e=>e.type===tab).map(e=>{const qty=extrasQty[e.id]?.quantity || 0;const ok=available(e.id);const item={...e,price:price(e.id,e.price)}; return <article className={`extra-card ${qty>0?'selected':''} ${ok?'':'soldout-card'}`} key={e.id}><img className="extra-card-image" src={e.image} alt={e.name}/><div className="extra-card-copy"><b>{e.name}</b>{e.weight&&<small>{e.weight}</small>}<strong>{ok?`$${item.price}`:'Agotado'}</strong></div><div className="inline-qty extra-card-qty"><button onClick={()=>changeExtraQty(item,-1)} disabled={!qty} aria-label={`Quitar ${e.name}`}><Minus size={14}/></button><b>{qty}</b><button disabled={!ok} onClick={()=>changeExtraQty(item,1)} aria-label={`Agregar ${e.name}`}><Plus size={14}/></button></div></article>})}</div>
    </Step>

    <div className="sticky-action builder-cart-bar">
      <div className="builder-cart-summary">
        <small>Tu {product.name}</small>
        <span>{customLine || 'Personaliza tu Chi-nito'}{extrasLine}</span>
        <strong>${unitPrice}</strong>
      </div>
      <div className="builder-cart-actions">
        <button className="primary add-cart-btn" disabled={!ready} onClick={onAdd}>Agregar al carrito</button>
      </div>
    </div>
  </main>
}

function Step({num,title,subtitle,right,children}){return <section className="step"><div className={`step-head ${!num?'optional-step-head':''}`}>{num&&<span className="step-num">{num}</span>}<div><h3>{title}</h3><p>{subtitle}</p></div>{right&&<div className="step-right">{right}</div>}</div>{children}</section>}


function CartSheet({items,total,onClose,onChangeQty,onRemove,onContinue}){
  return <div className="cart-sheet-overlay" onClick={onClose}>
    <section className="cart-sheet" onClick={e=>e.stopPropagation()} aria-label="Carrito">
      <div className="cart-sheet-handle" />
      <div className="cart-sheet-head">
        <div><small>TU CARRITO</small><h2>Tu pedido</h2></div>
        <button className="cart-sheet-close" onClick={onClose} aria-label="Cerrar carrito"><X size={22}/></button>
      </div>
      <div className="cart-sheet-items">
        {items.map(item=>{
          const unit=itemUnitPrice(item)
          const configured=item.kind==='configured'
          return <article className="cart-sheet-item" key={item.id}>
            <div className="cart-sheet-emoji"><img src={configured?item.product.image:item.image} alt={configured?item.product.name:item.name}/></div>
            <div className="cart-sheet-copy">
              <h3>{configured?item.product.name:item.name}</h3>
              {configured ? <>
                <p>{item.base?.name} · {item.guisados.map(g=>g.name).join(', ')}</p>
                {item.extras.length>0 && <p>{formatExtras(item.extras)}</p>}
              </> : item.variant && <p>{item.variant}</p>}
              <strong>${unit*item.quantity}</strong>
            </div>
            <div className="cart-sheet-qty">
              <button onClick={()=>onChangeQty(item.id,-1)} aria-label="Quitar uno"><Minus size={15}/></button>
              <span>{item.quantity}</span>
              <button onClick={()=>onChangeQty(item.id,1)} aria-label="Agregar uno"><Plus size={15}/></button>
            </div>
            <button className="cart-sheet-trash" onClick={()=>onRemove(item.id)} aria-label="Eliminar"><Trash2 size={17}/></button>
          </article>
        })}
      </div>
      <div className="cart-sheet-footer">
        <div><span>Total</span><strong>${total}</strong></div>
        <button className="primary cart-sheet-continue" onClick={onContinue}>Continuar <ChevronRight size={18}/></button>
      </div>
    </section>
  </div>
}

function Cart({items,total,pickup,setPickup,name,setName,phone,setPhone,payment,setPayment,onBack,onPlace,placing,placeError}){
  return <main className="page cart-page checkout-page">
    <div className="checkout-topline"><button className="checkout-nav-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={21}/></button><h2>Checkout</h2><span aria-hidden="true" /></div>

    <div className="pickup-banner"><ShoppingBag size={20}/><div><b>Solo pickup</b><span>Tu orden se prepara en nuestro local.</span></div><strong>RÁPIDO · FÁCIL</strong></div>

    <section className="cart-list checkout-order-list">
      {items.length===0 && <p className="empty-cart-copy">Tu carrito está vacío.</p>}
      {items.map(item=>{
        const unit=itemUnitPrice(item)
        const configured=item.kind==='configured'
        return <div className="cart-item main configured-cart-item checkout-order-item" key={item.id}>
          <div className="item-emoji"><img src={configured?item.product.image:item.image} alt={configured?item.product.name:item.name}/></div>
          <div className="item-copy">
            <h3>{item.quantity} × {configured?item.product.name:item.name}</h3>
            {configured ? <>
              <p><b>Base:</b> {item.base?.name}</p>
              <p><b>Guisados:</b> {item.guisados.map(g=>g.name).join(', ')}</p>
              {item.extras.length>0 && <p><b>Extras:</b> {formatExtras(item.extras)}</p>}
            </> : item.variant && <p><b>Tamaño:</b> {item.variant}</p>}
          </div>
          <strong>${unit*item.quantity}</strong>
        </div>
      })}
    </section>

    <section className="checkout-card"><div className="field-head"><Clock3 size={19}/><div><h3>Hora de pickup</h3><p>Selecciona tu hora</p></div></div><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 20–30 min</option><option>Hoy, 7:00 p.m.</option><option>Hoy, 7:30 p.m.</option><option>Hoy, 8:00 p.m.</option></select></section>

    <section className="checkout-card"><div className="field-head"><UserRound size={19}/><div><h3>Tus datos</h3><p>Para identificar tu pedido</p></div></div><div className="inputs"><input placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/></div></section>

    <section className="checkout-card"><div className="field-head"><CreditCard size={19}/><div><h3>Método de pago</h3><p>Selecciona una opción</p></div></div><div className="pay-grid"><button className={payment==='online'?'selected':''} onClick={()=>setPayment('online')}><CreditCard size={19}/><div><b>Pagar en línea</b><span>Tarjeta de crédito o débito</span></div></button><button className={payment==='pickup'?'selected':''} onClick={()=>setPayment('pickup')}><ShoppingBag size={19}/><div><b>Pagar al recoger</b><span>Efectivo o tarjeta</span></div></button></div></section>

    <section className="total-box"><div><span>Total</span><strong>${total}</strong></div>{placeError&&<p className="checkout-error">{placeError}</p>}<button className="primary checkout-confirm" disabled={!items.length||!name||!phone||placing} onClick={onPlace}>{placing?'Creando pedido…':'Confirmar pedido'} {!placing&&<ChevronRight size={18}/>}</button></section>
  </main>
}

function Success({order,onReset}){return <div className="success-screen"><div className="success-mark"><Check size={42}/></div><span className="eyebrow">PEDIDO CONFIRMADO</span><h1>¡Tu pedido ya llegó a cocina!</h1><p>Pedido <b>{order?.order_number||'confirmado'}</b>. Kitchen Mode lo recibió en tiempo real.</p><div className="success-card"><span>Total</span><strong>${Number(order?.total||0)}</strong><small>Solo pickup</small></div><button className="primary big" onClick={onReset}>Volver al inicio</button></div>}

export default App
