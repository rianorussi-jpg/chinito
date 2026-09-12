import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Clock3, CreditCard, Minus, Plus, ShoppingBag, Trash2, UserRound, X } from 'lucide-react'

const BASES = [
  { id:'frito', name:'Arroz frito', image:'/img/product/arroz-frito.jpg' },
  { id:'chowmein', name:'Chow mein', image:'/img/product/chow-mein.jpg' },
]
const GUISADOS = [
  { id:'naranja', name:'Pollo a la naranja', image:'/img/product/pollo-naranja.jpg' },
  { id:'agridulce', name:'Pollo agridulce', image:'/img/product/pollo-agridulce.jpg' },
  { id:'brocoli', name:'Res con brócoli', image:'/img/product/res-brocoli.jpg' },
  { id:'bbq', name:'Cerdo BBQ', image:'/img/product/cerdo-bbq.jpg' },
  { id:'verduras', name:'Verduras mixtas', image:'/img/product/verduras-mixtas.jpg' },
  { id:'chopsuey', name:'Chop suey', image:'/img/product/chop-suey.jpg' },
  { id:'teriyaki', name:'Pollo teriyaki', image:'/img/product/pollo-teriyaki.jpg' },
  { id:'kungpao', name:'Pollo kung pao', image:'/img/product/pollo-kung-pao.jpg' },
  { id:'mongol', name:'Res mongoliana', image:'/img/product/res-mongoliana.jpg' },
]
const PRODUCTOS = [
  { id:1, name:'Chi-nito 1', baseCount:1, guisados:1, price:95, desc:'Ideal para un antojo rápido.', image:'/img/product/chi-nito-1.jpg' },
  { id:2, name:'Chi-nito 2', baseCount:1, guisados:2, price:115, desc:'El balance perfecto para comer bien.', image:'/img/product/chi-nito-2.jpg' },
  { id:3, name:'Chi-nito 3', baseCount:1, guisados:3, price:135, desc:'El máximo de sabor en un solo bowl.', image:'/img/product/chi-nito-3.jpg' },
]
const EXTRAS = [
  { id:'te', type:'Bebidas', name:'Té helado', price:35, image:'/img/product/te-helado.jpg' },
  { id:'refresco', type:'Bebidas', name:'Refresco', price:30, image:'/img/product/refresco.jpg' },
  { id:'agua', type:'Bebidas', name:'Agua', price:25, image:'/img/product/agua.jpg' },
  { id:'rollitos', type:'Complementos', name:'Rollito primavera', price:35, image:'/img/product/rollito-primavera.jpg' },
  { id:'wanton', type:'Complementos', name:'Wantán crujiente', price:45, image:'/img/product/wantan-crujiente.jpg' },
  { id:'salsa', type:'Salsas', name:'Salsa extra', price:12, image:'/img/product/salsa-extra.jpg' },
]

const COMPLEMENTOS_HOME = [
  { id:'rollitos-home', name:'Rollitos primavera', price:35, image:'/img/product/rollito-primavera.jpg' },
  { id:'wanton-home', name:'Wantán crujiente', price:45, image:'/img/product/wantan-crujiente.jpg' },
  { id:'camaron-home', name:'Camarones empanizados', price:79, image:'/img/product/camarones-empanizados.jpg' },
  { id:'arroz-home', name:'Arroz frito extra', price:42, image:'/img/product/arroz-frito-extra.jpg' },
  { id:'chow-home', name:'Chow mein extra', price:45, image:'/img/product/chow-mein-extra.jpg' },
  { id:'galletas-home', name:'Galletas de la fortuna', price:18, image:'/img/product/galletas-fortuna.jpg' },
]

const BEBIDAS_HOME = [
  { id:'te-casa-home', name:'Té de la casa', price:35, image:'/img/product/te-casa.jpg', mode:'qty' },
  { id:'refresco-home', name:'Refresco', price:30, image:'/img/product/refresco.jpg', mode:'choose' },
  { id:'agua-home', name:'Botella de agua', price:25, image:'/img/product/botella-agua.jpg', mode:'qty' },
]

const REFRESCO_SABORES = ['Coca-Cola','Coca-Cola Zero','Sprite','Fanta','Manzanita']

const GUISADOS_PARA_LLEVAR = GUISADOS.map((g,index)=>({
  ...g,
  halfPrice:[95,95,105,110,85,90,100,100,115][index],
  literPrice:[175,175,195,205,155,165,185,185,215][index],
}))

const itemUnitPrice=(item)=> item.kind==='configured'
  ? item.product.price + item.extras.reduce((s,e)=>s+e.price,0)
  : item.price

function App(){
  const [screen,setScreen]=useState('home')
  const [product,setProduct]=useState(PRODUCTOS[2])
  const [base,setBase]=useState(BASES[0])
  const [guisados,setGuisados]=useState([GUISADOS[1]])
  const [tab,setTab]=useState('Bebidas')
  const [extras,setExtras]=useState([])
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

  const addProduct=(p)=>{
    setProduct(p)
    setBase(BASES[0])
    setGuisados([])
    setExtras([])
    setScreen('builder')
    window.scrollTo(0,0)
  }
  const toggleGuisado=(g)=>{
    setGuisados(prev => prev.some(x=>x.id===g.id) ? prev.filter(x=>x.id!==g.id) : prev.length<product.guisados ? [...prev,g] : prev)
  }
  const toggleExtra=(e)=>setExtras(prev=>prev.some(x=>x.id===e.id)?prev.filter(x=>x.id!==e.id):[...prev,e])
  const ready=base && guisados.length>=1

  const addConfiguredToCart=()=>{
    if(!ready) return
    const item={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      kind:'configured',
      product,
      base,
      guisados:[...guisados],
      extras:[...extras],
      quantity:1,
    }
    setCartItems(prev=>[...prev,item])
    setScreen('home')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const addSimpleItem=(entry)=>{
    const key=`${entry.kind}-${entry.refId}-${entry.variant || ''}`
    setCartItems(prev=>{
      const existing=prev.find(item=>item.cartKey===key)
      if(existing) return prev.map(item=>item.cartKey===key?{...item,quantity:item.quantity+1}:item)
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
    const next=item.quantity+delta
    return next<=0?[]:[{...item,quantity:next}]
  }))
  const cartCount=cartItems.reduce((sum,item)=>sum+item.quantity,0)
  const cartTotal=useMemo(()=>cartItems.reduce((sum,item)=>sum+(itemUnitPrice(item)*item.quantity),0),[cartItems])

  if(placed) return <Success onReset={()=>{setPlaced(false);setScreen('home');setCartItems([])}} />

  return <div className="app-shell">
    {screen!=='builder' && screen!=='cart' && <header className="topbar">
      <button className="icon-btn profile-btn" onClick={()=>setProfileOpen(true)} aria-label="Ver perfil"><UserRound size={23}/></button>
      <div className="brand-mini" onClick={()=>setScreen('home')}><img src="/logo.jpg" alt="Chi-nito"/></div>
      <div className="topbar-spacer" aria-hidden="true" />
    </header>}

    {screen==='home' && <>
      <Home onPick={addProduct} onAddSimple={addSimpleItem} onRemoveSimple={removeSimpleItem} getCartQty={getCartQty} />
      {cartCount>0 && <button className="home-cart-float" onClick={()=>setCartOpen(true)}><ShoppingBag size={19}/><span>Ver carrito</span><b>{cartCount}</b></button>}
      {cartOpen && <CartSheet items={cartItems} total={cartTotal} onClose={()=>setCartOpen(false)} onChangeQty={changeCartQty} onRemove={removeCartItem} onContinue={()=>{setCartOpen(false);setScreen('cart');window.scrollTo(0,0)}} />}
    </>}
    {screen==='builder' && <Builder product={product} base={base} setBase={setBase} guisados={guisados} toggleGuisado={toggleGuisado} tab={tab} setTab={setTab} extras={extras} toggleExtra={toggleExtra} ready={ready} onBack={()=>setScreen('home')} onAdd={addConfiguredToCart} />}
    {screen==='cart' && <Cart items={cartItems} total={cartTotal} pickup={pickup} setPickup={setPickup} name={name} setName={setName} phone={phone} setPhone={setPhone} payment={payment} setPayment={setPayment} onBack={()=>setScreen('home')} onPlace={()=>setPlaced(true)} />}

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

function Home({onPick,onAddSimple,onRemoveSimple,getCartQty}){
  const [takeawaySize,setTakeawaySize]=useState('half')
  const [sodaOpen,setSodaOpen]=useState(false)
  const goToMenu=()=>document.getElementById('menu-chinito')?.scrollIntoView({behavior:'smooth',block:'start'})
  const variant=takeawaySize==='half'?'1/2 litro':'1 litro'
  return <main>
    <section className="home-hero-image" onClick={goToMenu} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' ') goToMenu()}} aria-label="Ver menú de Chi-nito">
      <img src="/img/inicio.jpg" alt="Arma tu Chi-nito - Solo pickup" />
    </section>

    <section className="section-wrap" id="menu-chinito">
      <div className="section-head"><div><h2>Nuestros Chi-nitos</h2></div><span className="muted">1 base + tus guisados favoritos</span></div>
      <div className="product-grid">{PRODUCTOS.map((p)=><article className="product-card" key={p.id}>
        <div className="product-visual"><img src={p.image} alt={p.name}/></div>
        <div className="badge">{p.guisados} guisado{p.guisados>1?'s':''}</div>
        <h3>{p.name}</h3><p>1 base + {p.guisados} guisado{p.guisados>1?'s':''}</p><small>{p.desc}</small>
        <div className="product-foot"><strong>Desde ${p.price}</strong><button onClick={()=>onPick(p)}>Elegir</button></div>
      </article>)}</div>
    </section>

    <section className="home-scroll-section complements-section">
      <div className="home-scroll-head"><h2>Complementos</h2><span>Desliza para ver más</span></div>
      <div className="home-card-scroller">
        {COMPLEMENTOS_HOME.map(item=>{
          const qty=getCartQty('addon',item.id)
          return <article className="home-add-card" key={item.id}>
            <div className="home-add-visual"><img src={item.image} alt={item.name}/></div>
            <div className="home-add-copy"><h3>{item.name}</h3><strong>${item.price}</strong></div>
            <div className="home-add-actions">
              <span>Agregar</span>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('addon',item.id)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button onClick={()=>onAddSimple({kind:'addon',refId:item.id,name:item.name,image:item.image,price:item.price})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
              </div>
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="home-scroll-section takeaway-section">
      <div className="home-scroll-head takeaway-head">
        <div><h2>Guisados para llevar</h2><span>Elige el tamaño y desliza para ver los 9</span></div>
        <div className="size-switch" aria-label="Tamaño de guisado">
          <button className={takeawaySize==='half'?'active':''} onClick={()=>setTakeawaySize('half')}>1/2 litro</button>
          <button className={takeawaySize==='liter'?'active':''} onClick={()=>setTakeawaySize('liter')}>1 litro</button>
        </div>
      </div>
      <div className="home-card-scroller">
        {GUISADOS_PARA_LLEVAR.map(item=>{
          const price=takeawaySize==='half'?item.halfPrice:item.literPrice
          const qty=getCartQty('takeaway',item.id,variant)
          return <article className="home-add-card" key={`${item.id}-${takeawaySize}`}>
            <div className="home-add-visual takeaway"><img src={item.image} alt={item.name}/><small>{variant}</small></div>
            <div className="home-add-copy"><h3>{item.name}</h3><strong>${price}</strong></div>
            <div className="home-add-actions">
              <span>Agregar</span>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('takeaway',item.id,variant)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button onClick={()=>onAddSimple({kind:'takeaway',refId:item.id,variant,name:item.name,image:item.image,price})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
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
          return <article className="home-add-card" key={item.id}>
            <div className="home-add-visual"><img src={item.image} alt={item.name}/></div>
            <div className="home-add-copy"><h3>{item.name}</h3><strong>${item.price}</strong></div>
            {item.mode==='choose' ? <div className="home-add-actions drink-choose-actions">
              <span>Elegir</span>
              <button className="drink-choose-btn" onClick={()=>setSodaOpen(true)}>Elegir</button>
            </div> : <div className="home-add-actions">
              <span>Agregar</span>
              <div className="inline-qty">
                <button onClick={()=>onRemoveSimple('drink',item.id)} disabled={!qty} aria-label={`Quitar ${item.name}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button onClick={()=>onAddSimple({kind:'drink',refId:item.id,name:item.name,image:item.image,price:item.price})} aria-label={`Agregar ${item.name}`}><Plus size={14}/></button>
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
            const qty=getCartQty('drink','refresco-home',flavor)
            return <div className="soda-flavor-row" key={flavor}>
              <div><img className="soda-product-image" src="/img/product/refresco.jpg" alt="Refresco"/><b>{flavor}</b></div>
              <div className="inline-qty soda-qty">
                <button onClick={()=>onRemoveSimple('drink','refresco-home',flavor)} disabled={!qty} aria-label={`Quitar ${flavor}`}><Minus size={14}/></button>
                <b>{qty}</b>
                <button onClick={()=>onAddSimple({kind:'drink',refId:'refresco-home',variant:flavor,name:'Refresco',image:'/img/product/refresco.jpg',price:30})} aria-label={`Agregar ${flavor}`}><Plus size={14}/></button>
              </div>
            </div>
          })}
        </div>
      </section>
    </div>}
  </main>
}

function Builder({product,base,setBase,guisados,toggleGuisado,tab,setTab,extras,toggleExtra,ready,onBack,onAdd}){
  const guisadosSubtitle = product.guisados === 1 ? 'Selecciona 1 guisado' : `Selecciona de 1 a ${product.guisados} guisados`
  const unitPrice=product.price+extras.reduce((s,e)=>s+e.price,0)
  const customLine=[base?.name,...guisados.map(g=>g.name)].filter(Boolean).join(' · ')
  const extrasLine=extras.length?` + ${extras.map(e=>e.name).join(', ')}`:''

  return <main className="page builder-page">
    <div className="builder-topline"><button className="builder-nav-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={22}/></button><h2>Personaliza tu Chi-nito</h2><span aria-hidden="true"></span></div>
    <section className="summary-card"><div className="summary-food"><img src={product.image} alt={product.name}/></div><div><h3>{product.name}</h3><p>1 base + {product.guisados} guisados</p><span>{product.desc}</span></div><strong>${product.price}</strong></section>

    <Step num="1" title="Elige tu base" subtitle="Selecciona una opción">
      <div className="choice-grid bases">{BASES.map(x=><button className={`choice ${base?.id===x.id?'selected':''}`} key={x.id} onClick={()=>setBase(x)}><img className="choice-emoji" src={x.image} alt={x.name}/><b>{x.name}</b>{base?.id===x.id&&<i><Check size={14}/></i>}</button>)}</div>
    </Step>

    <Step num="2" title="Elige tus guisados" subtitle={guisadosSubtitle}>
      <div className="choice-grid guisos">{GUISADOS.map(x=>{const selected=guisados.some(g=>g.id===x.id); return <button className={`choice ${selected?'selected':''}`} key={x.id} onClick={()=>toggleGuisado(x)}><img className="choice-emoji" src={x.image} alt={x.name}/><b>{x.name}</b>{selected&&<i><Check size={14}/></i>}</button>})}</div>
    </Step>

    <Step title="Agrega más a tu orden" subtitle="Opcional">
      <div className="tabs">{['Bebidas','Complementos','Salsas'].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t}</button>)}</div>
      <div className="extras-grid">{EXTRAS.filter(e=>e.type===tab).map(e=>{const selected=extras.some(x=>x.id===e.id); return <button className={`extra-card ${selected?'selected':''}`} key={e.id} onClick={()=>toggleExtra(e)}><img className="extra-card-image" src={e.image} alt={e.name}/><div><b>{e.name}</b><strong>${e.price}</strong></div><i>{selected?<Check size={15}/>:<Plus size={15}/>}</i></button>})}</div>
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
                {item.extras.length>0 && <p>{item.extras.map(e=>e.name).join(', ')}</p>}
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

function Cart({items,total,pickup,setPickup,name,setName,phone,setPhone,payment,setPayment,onBack,onPlace}){
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
              {item.extras.length>0 && <p><b>Extras:</b> {item.extras.map(e=>e.name).join(', ')}</p>}
            </> : item.variant && <p><b>Tamaño:</b> {item.variant}</p>}
          </div>
          <strong>${unit*item.quantity}</strong>
        </div>
      })}
    </section>

    <section className="checkout-card"><div className="field-head"><Clock3 size={19}/><div><h3>Hora de pickup</h3><p>Selecciona tu hora</p></div></div><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 20–30 min</option><option>Hoy, 7:00 p.m.</option><option>Hoy, 7:30 p.m.</option><option>Hoy, 8:00 p.m.</option></select></section>

    <section className="checkout-card"><div className="field-head"><UserRound size={19}/><div><h3>Tus datos</h3><p>Para identificar tu pedido</p></div></div><div className="inputs"><input placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/></div></section>

    <section className="checkout-card"><div className="field-head"><CreditCard size={19}/><div><h3>Método de pago</h3><p>Selecciona una opción</p></div></div><div className="pay-grid"><button className={payment==='online'?'selected':''} onClick={()=>setPayment('online')}><CreditCard size={19}/><div><b>Pagar en línea</b><span>Tarjeta de crédito o débito</span></div></button><button className={payment==='pickup'?'selected':''} onClick={()=>setPayment('pickup')}><ShoppingBag size={19}/><div><b>Pagar al recoger</b><span>Efectivo o tarjeta</span></div></button></div></section>

    <section className="total-box"><div><span>Total</span><strong>${total}</strong></div><button className="primary checkout-confirm" disabled={!items.length||!name||!phone} onClick={onPlace}>Confirmar pedido <ChevronRight size={18}/></button></section>
  </main>
}

function Success({onReset}){return <div className="success-screen"><div className="success-mark"><Check size={42}/></div><span className="eyebrow">PEDIDO CONFIRMADO</span><h1>¡Tu Chi-nito ya se está preparando!</h1><p>Pedido <b>#CN-1048</b>. Te avisaremos cuando esté listo para recoger.</p><div className="success-card"><span>Tiempo estimado</span><strong>20–30 min</strong><small>Solo pickup</small></div><button className="primary big" onClick={onReset}>Volver al inicio</button></div>}

export default App
