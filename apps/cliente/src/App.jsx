import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Clock3, CreditCard, Plus, ShoppingBag, Trash2, UserRound } from 'lucide-react'

const BASES = [
  { id:'frito', name:'Arroz frito', emoji:'🥘' },
  { id:'chowmein', name:'Chow mein', emoji:'🍜' },
]
const GUISADOS = [
  { id:'naranja', name:'Pollo a la naranja', emoji:'🍗' },
  { id:'agridulce', name:'Pollo agridulce', emoji:'🥢' },
  { id:'brocoli', name:'Res con brócoli', emoji:'🥦' },
  { id:'bbq', name:'Cerdo BBQ', emoji:'🍖' },
  { id:'verduras', name:'Verduras mixtas', emoji:'🥬' },
  { id:'chopsuey', name:'Chop suey', emoji:'🥡' },
  { id:'teriyaki', name:'Pollo teriyaki', emoji:'🍱' },
  { id:'kungpao', name:'Pollo kung pao', emoji:'🌶️' },
  { id:'mongol', name:'Res mongoliana', emoji:'🥩' },
]
const PRODUCTOS = [
  { id:1, name:'Chi-nito 1', baseCount:1, guisados:1, price:95, desc:'Ideal para un antojo rápido.' },
  { id:2, name:'Chi-nito 2', baseCount:1, guisados:2, price:115, desc:'El balance perfecto para comer bien.' },
  { id:3, name:'Chi-nito 3', baseCount:1, guisados:3, price:135, desc:'El máximo de sabor en un solo bowl.' },
]
const EXTRAS = [
  { id:'te', type:'Bebidas', name:'Té helado', price:35, emoji:'🥤' },
  { id:'refresco', type:'Bebidas', name:'Refresco', price:30, emoji:'🥤' },
  { id:'agua', type:'Bebidas', name:'Agua', price:25, emoji:'💧' },
  { id:'rollitos', type:'Complementos', name:'Rollito primavera', price:35, emoji:'🥟' },
  { id:'wanton', type:'Complementos', name:'Wantán crujiente', price:45, emoji:'🥠' },
  { id:'salsa', type:'Salsas', name:'Salsa extra', price:12, emoji:'🌶️' },
]

function App(){
  const [screen,setScreen]=useState('home')
  const [product,setProduct]=useState(PRODUCTOS[2])
  const [base,setBase]=useState(BASES[0])
  const [guisados,setGuisados]=useState([GUISADOS[1]])
  const [tab,setTab]=useState('Bebidas')
  const [extras,setExtras]=useState([])
  const [builderQty,setBuilderQty]=useState(1)
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
    setBuilderQty(1)
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
      product,
      base,
      guisados:[...guisados],
      extras:[...extras],
      quantity:builderQty,
    }
    setCartItems(prev=>[...prev,item])
    setScreen('home')
    setBuilderQty(1)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const removeCartItem=(id)=>setCartItems(prev=>prev.filter(item=>item.id!==id))
  const cartCount=cartItems.reduce((sum,item)=>sum+item.quantity,0)
  const cartTotal=useMemo(()=>cartItems.reduce((sum,item)=>{
    const unit=item.product.price+item.extras.reduce((s,e)=>s+e.price,0)
    return sum+(unit*item.quantity)
  },0),[cartItems])

  if(placed) return <Success onReset={()=>{setPlaced(false);setScreen('home');setCartItems([])}} />

  return <div className="app-shell">
    {screen!=='builder' && <header className="topbar">
      <button className="icon-btn profile-btn" onClick={()=>setScreen('profile')} aria-label="Ver perfil"><UserRound size={23}/></button>
      <div className="brand-mini" onClick={()=>setScreen('home')}><img src="/logo.jpg" alt="Chi-nito"/></div>
      <div className="topbar-spacer" aria-hidden="true" />
    </header>}

    {screen==='home' && <>
      <Home onPick={addProduct} />
      {cartCount>0 && <button className="home-cart-float" onClick={()=>setScreen('cart')}><ShoppingBag size={19}/><span>Ver carrito</span><b>{cartCount}</b></button>}
    </>}
    {screen==='builder' && <Builder product={product} base={base} setBase={setBase} guisados={guisados} toggleGuisado={toggleGuisado} tab={tab} setTab={setTab} extras={extras} toggleExtra={toggleExtra} ready={ready} quantity={builderQty} setQuantity={setBuilderQty} onBack={()=>setScreen('home')} onAdd={addConfiguredToCart} />}
    {screen==='profile' && <Profile name={name} setName={setName} phone={phone} setPhone={setPhone} onBack={()=>setScreen('home')} />}
    {screen==='cart' && <Cart items={cartItems} total={cartTotal} pickup={pickup} setPickup={setPickup} name={name} setName={setName} phone={phone} setPhone={setPhone} payment={payment} setPayment={setPayment} onBack={()=>setScreen('home')} onRemove={removeCartItem} onPlace={()=>setPlaced(true)} />}
  </div>
}

function Profile({name,setName,phone,setPhone,onBack}){
  return <main className="page profile-page">
    <div className="page-title"><button className="back" onClick={onBack}><ArrowLeft/></button><div><span className="eyebrow">MI CUENTA</span><h2>Mi perfil</h2></div></div>
    <section className="profile-card">
      <div className="profile-avatar"><UserRound size={42}/></div>
      <div className="profile-heading"><h3>Tus datos</h3><p>Estos datos se usarán para identificar tus pedidos de pickup.</p></div>
      <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" /></label>
      <label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Tu teléfono" inputMode="tel" /></label>
      <button className="primary profile-save" onClick={onBack}>Guardar datos</button>
    </section>
  </main>
}

function Home({onPick}){
  const goToMenu=()=>document.getElementById('menu-chinito')?.scrollIntoView({behavior:'smooth',block:'start'})
  return <main>
    <section className="home-hero-image" onClick={goToMenu} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' ') goToMenu()}} aria-label="Ver menú de Chi-nito">
      <img src="/img/inicio.jpg" alt="Arma tu Chi-nito - Solo pickup" />
    </section>

    <section className="section-wrap" id="menu-chinito">
      <div className="section-head"><div><h2>Nuestros Chi-nitos</h2></div><span className="muted">1 base + tus guisados favoritos</span></div>
      <div className="product-grid">{PRODUCTOS.map((p,i)=><article className="product-card" key={p.id}>
        <div className="product-visual">{['🥘','🍜','🥡'][i]}</div>
        <div className="badge">{p.guisados} guisado{p.guisados>1?'s':''}</div>
        <h3>{p.name}</h3><p>1 base + {p.guisados} guisado{p.guisados>1?'s':''}</p><small>{p.desc}</small>
        <div className="product-foot"><strong>Desde ${p.price}</strong><button onClick={()=>onPick(p)}>Elegir</button></div>
      </article>)}</div>
    </section>
  </main>
}

function Builder({product,base,setBase,guisados,toggleGuisado,tab,setTab,extras,toggleExtra,ready,quantity,setQuantity,onBack,onAdd}){
  const guisadosSubtitle = product.guisados === 1 ? 'Selecciona 1 guisado' : `Selecciona de 1 a ${product.guisados} guisados`
  const unitPrice=product.price+extras.reduce((s,e)=>s+e.price,0)
  const customLine=[base?.name,...guisados.map(g=>g.name)].filter(Boolean).join(' · ')
  const extrasLine=extras.length?` + ${extras.map(e=>e.name).join(', ')}`:''

  return <main className="page builder-page">
    <div className="builder-topline"><button className="builder-nav-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={22}/></button><h2>Personaliza tu Chi-nito</h2><span aria-hidden="true"></span></div>
    <section className="summary-card"><div className="summary-food">🥘</div><div><h3>{product.name}</h3><p>1 base + {product.guisados} guisados</p><span>{product.desc}</span></div><strong>${product.price}</strong></section>

    <Step num="1" title="Elige tu base" subtitle="Selecciona una opción">
      <div className="choice-grid bases">{BASES.map(x=><button className={`choice ${base?.id===x.id?'selected':''}`} key={x.id} onClick={()=>setBase(x)}><span className="choice-emoji">{x.emoji}</span><b>{x.name}</b>{base?.id===x.id&&<i><Check size={14}/></i>}</button>)}</div>
    </Step>

    <Step num="2" title="Elige tus guisados" subtitle={guisadosSubtitle}>
      <div className="choice-grid guisos">{GUISADOS.map(x=>{const selected=guisados.some(g=>g.id===x.id); return <button className={`choice ${selected?'selected':''}`} key={x.id} onClick={()=>toggleGuisado(x)}><span className="choice-emoji">{x.emoji}</span><b>{x.name}</b>{selected&&<i><Check size={14}/></i>}</button>})}</div>
    </Step>

    <Step title="Agrega más a tu orden" subtitle="Opcional">
      <div className="tabs">{['Bebidas','Complementos','Salsas'].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t}</button>)}</div>
      <div className="extras-grid">{EXTRAS.filter(e=>e.type===tab).map(e=>{const selected=extras.some(x=>x.id===e.id); return <button className={`extra-card ${selected?'selected':''}`} key={e.id} onClick={()=>toggleExtra(e)}><span>{e.emoji}</span><div><b>{e.name}</b><strong>${e.price}</strong></div><i>{selected?<Check size={15}/>:<Plus size={15}/>}</i></button>})}</div>
    </Step>

    <div className="sticky-action builder-cart-bar">
      <div className="builder-cart-summary">
        <small>Tu {product.name}</small>
        <span>{customLine || 'Personaliza tu Chi-nito'}{extrasLine}</span>
        <strong>${unitPrice*quantity}</strong>
      </div>
      <div className="builder-cart-actions">
        <div className="builder-qty" aria-label="Cantidad">
          <span>{quantity}</span>
          <button type="button" onClick={()=>setQuantity(q=>q+1)} aria-label="Agregar otro igual"><Plus size={17}/></button>
        </div>
        <button className="primary add-cart-btn" disabled={!ready} onClick={onAdd}>Agregar al carrito</button>
      </div>
    </div>
  </main>
}

function Step({num,title,subtitle,right,children}){return <section className="step"><div className={`step-head ${!num?'optional-step-head':''}`}>{num&&<span className="step-num">{num}</span>}<div><h3>{title}</h3><p>{subtitle}</p></div>{right&&<div className="step-right">{right}</div>}</div>{children}</section>}

function Cart({items,total,pickup,setPickup,name,setName,phone,setPhone,payment,setPayment,onBack,onRemove,onPlace}){
  return <main className="page cart-page">
    <div className="page-title"><button className="back" onClick={onBack}><ArrowLeft/></button><div><span className="eyebrow">CHECKOUT</span><h2>Tu pedido</h2></div></div>
    <div className="pickup-banner"><ShoppingBag/><div><b>Solo pickup</b><span>Tu orden se prepara en nuestro local.</span></div><strong>RÁPIDO<br/>FÁCIL<br/>SIN ESPERAS</strong></div>

    <section className="cart-list">
      {items.length===0 && <p className="empty-cart-copy">Tu carrito está vacío.</p>}
      {items.map(item=>{
        const unit=item.product.price+item.extras.reduce((s,e)=>s+e.price,0)
        return <div className="cart-item main configured-cart-item" key={item.id}>
          <div className="item-emoji">🥘</div>
          <div className="item-copy">
            <h3>{item.quantity} × {item.product.name}</h3>
            <p><b>Base:</b> {item.base?.name}</p>
            <p><b>Guisados:</b> {item.guisados.map(g=>g.name).join(', ')}</p>
            {item.extras.length>0 && <p><b>Extras:</b> {item.extras.map(e=>e.name).join(', ')}</p>}
          </div>
          <strong>${unit*item.quantity}</strong>
          <button className="trash" onClick={()=>onRemove(item.id)} aria-label="Eliminar"><Trash2 size={18}/></button>
        </div>
      })}
    </section>

    <section className="checkout-card"><div className="field-head"><Clock3/><div><h3>Hora de pickup</h3><p>Selecciona tu hora</p></div></div><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 20–30 min</option><option>Hoy, 7:00 p.m.</option><option>Hoy, 7:30 p.m.</option><option>Hoy, 8:00 p.m.</option></select></section>

    <section className="checkout-card"><div className="field-head"><UserRound/><div><h3>Tus datos</h3><p>Para identificar tu pedido</p></div></div><div className="inputs"><input placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/></div></section>

    <section className="checkout-card"><div className="field-head"><CreditCard/><div><h3>Método de pago</h3><p>Selecciona una opción</p></div></div><div className="pay-grid"><button className={payment==='online'?'selected':''} onClick={()=>setPayment('online')}><CreditCard/><div><b>Pagar en línea</b><span>Tarjeta de crédito o débito</span></div></button><button className={payment==='pickup'?'selected':''} onClick={()=>setPayment('pickup')}><ShoppingBag/><div><b>Pagar al recoger</b><span>Efectivo o tarjeta</span></div></button></div></section>

    <section className="total-box"><div><span>Total</span><strong>${total}</strong></div><button className="primary big" disabled={!items.length||!name||!phone} onClick={onPlace}>Confirmar pedido <ChevronRight/></button></section>
  </main>
}

function Success({onReset}){return <div className="success-screen"><div className="success-mark"><Check size={42}/></div><span className="eyebrow">PEDIDO CONFIRMADO</span><h1>¡Tu Chi-nito ya se está preparando!</h1><p>Pedido <b>#CN-1048</b>. Te avisaremos cuando esté listo para recoger.</p><div className="success-card"><span>Tiempo estimado</span><strong>20–30 min</strong><small>Solo pickup</small></div><button className="primary big" onClick={onReset}>Volver al inicio</button></div>}

export default App
