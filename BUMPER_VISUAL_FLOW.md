# 🎯 Bumper Products - Visual Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MERCHANT SIDE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  AffiliateCreateProduct.js (Product Builder)         │           │
│  │                                                       │           │
│  │  ┌────────────────────────────────────────────────┐  │           │
│  │  │ Bumper Products Section                       │  │           │
│  │  │                                                │  │           │
│  │  │  Message: [Want to add for 20% off?      ]   │  │           │
│  │  │           Quick: [20% off][Complete][...]     │  │           │
│  │  │                                                │  │           │
│  │  │  CTA:     [Add to cart               ]        │  │           │
│  │  │           Quick: [Add][Yes!][Grab it]         │  │           │
│  │  │                                                │  │           │
│  │  │  Products: ☑ Frame Kit (£12.99)              │  │           │
│  │  │            ☑ LED Strip (£8.99)                │  │           │
│  │  │            ☐ Wall Mount (£6.99)               │  │           │
│  │  └────────────────────────────────────────────────┘  │           │
│  │                                                       │           │
│  │  [Save Product] ─────────────────────────────────────┼──────┐    │
│  └──────────────────────────────────────────────────────┘      │    │
│                                                                 │    │
└─────────────────────────────────────────────────────────────────┼────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FIREBASE DATABASE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  products/                                                            │
│    product_123/                                                       │
│      title: "Premium Mirror"                                         │
│      price: 29.99                                                    │
│      bumperMessage: "Want to add this for 20% off?"                 │
│      bumperCTA: "Add to cart"                                        │
│      bumperProducts: [                                               │
│        { id: "product_456", title: "Frame Kit", price: 12.99 }      │
│        { id: "product_789", title: "LED Strip", price: 8.99 }       │
│      ]                                                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  │
┌─────────────────────────────────────────────────────────────────┼───┐
│                         CUSTOMER SIDE                           │   │
├─────────────────────────────────────────────────────────────────┼───┤
│                                                                 │   │
│  ┌──────────────────────────────────────────────────┐          │   │
│  │  STEP 1: Product Page                            │          │   │
│  │  ┌─────────────────────────────────────────────┐ │          │   │
│  │  │                                              │ │          │   │
│  │  │   Premium Mirror                            │ │          │   │
│  │  │   £29.99                                    │ │          │   │
│  │  │                                              │ │          │   │
│  │  │   [Add to Cart] ◄─── Customer clicks        │ │          │   │
│  │  │                                              │ │          │   │
│  │  └─────────────────────────────────────────────┘ │          │   │
│  └──────────────────────────────────────────────────┘          │   │
│                        │                                        │   │
│                        ▼                                        │   │
│  ┌──────────────────────────────────────────────────┐          │   │
│  │  STEP 2: Shopping Cart                           │          │   │
│  │  ┌─────────────────────────────────────────────┐ │          │   │
│  │  │  📦 Premium Mirror - £29.99                 │ │          │   │
│  │  └─────────────────────────────────────────────┘ │          │   │
│  │                                                   │          │   │
│  │  [Proceed to Checkout] ◄─── Customer clicks     │          │   │
│  └──────────────────────────────────────────────────┘          │   │
│                        │                                        │   │
│                        ▼                                        │   │
│  ┌──────────────────────────────────────────────────┐          │   │
│  │  STEP 3: Checkout - Contact Info                 │          │   │
│  │  ┌─────────────────────────────────────────────┐ │          │   │
│  │  │  Email: john@example.com                    │ │          │   │
│  │  │  Phone: 07123 456789                        │ │          │   │
│  │  │                                              │ │          │   │
│  │  │  [Continue to Shipping] ◄─── Customer clicks│ │          │   │
│  │  └─────────────────────────────────────────────┘ │          │   │
│  └──────────────────────────────────────────────────┘          │   │
│                        │                                        │   │
│                        ▼                                        │   │
│  ┌──────────────────────────────────────────────────┐          │   │
│  │  STEP 4: 🎯 BUMPER PRODUCTS APPEAR! 🎯           │ ◄────────┤   │
│  │                                                   │          ▲   │
│  │  ╔════════════════════════════════════════════╗  │          │   │
│  │  ║ ✨ Complete Your Order                    ║  │          │   │
│  │  ║ Customers who bought this also added      ║  │          │   │
│  │  ╠════════════════════════════════════════════╣  │  ┌───────┼───┤
│  │  ║ 📦 Frame Kit                              ║  │  │ Bumper│   │
│  │  ║ Want to add this for 20% off?            ║  │  │Product│   │
│  │  ║ £12.99         [+ Add to cart] ◄──────────╫──┼──┤Widget │   │
│  │  ╠════════════════════════════════════════════╣  │  │       │   │
│  │  ║ 💡 LED Strip                              ║  │  │Loads  │   │
│  │  ║ Want to add this for 20% off?            ║  │  │from   │   │
│  │  ║ £8.99          [+ Add to cart]            ║  │  │Firebase│  │
│  │  ╚════════════════════════════════════════════╝  │  └───────┘   │
│  │                                                   │              │
│  │  [Continue to Shipping]                          │              │
│  └──────────────────────────────────────────────────┘              │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │  STEP 5: Shipping Address                        │              │
│  │  [Continue to Payment]                           │              │
│  └──────────────────────────────────────────────────┘              │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │  STEP 6: Payment                                  │              │
│  │                                                   │              │
│  │  Order Summary:                                   │              │
│  │  • Premium Mirror      £29.99                    │              │
│  │  • Frame Kit          £12.99  ◄── Added bumper! │              │
│  │  • LED Strip           £8.99  ◄── Added bumper! │              │
│  │  ─────────────────────────────                   │              │
│  │  Total:               £51.97                     │              │
│  │                                                   │              │
│  │  [Complete Order]                                │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CHECKOUT PAGE                                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ const [cartItems, setCartItems] = useState([...])              │  │
│  │ const [addedBumperIds, setAddedBumperIds] = useState([])       │  │
│  │                                                                 │  │
│  │ const handleAddBumper = (bumperItem) => {                      │  │
│  │   setCartItems(prev => [...prev, bumperItem])                 │  │
│  │   setAddedBumperIds(prev => [...prev, bumperItem.id])         │  │
│  │ }                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │                                      │
│                                ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ <BumperProductWidget                                           │  │
│  │   cartItems={cartItems}           ─────┐                       │  │
│  │   onAddBumper={handleAddBumper}  ◄─────┼─ Props                │  │
│  │   addedBumperIds={addedBumperIds} ─────┘                       │  │
│  │ />                                                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BUMPER PRODUCT WIDGET                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ useEffect(() => {                                              │  │
│  │   loadBumperProducts()  ──────┐                                │  │
│  │ }, [cartItems])               │                                │  │
│  └───────────────────────────────┼────────────────────────────────┘  │
│                                  │                                    │
│  ┌───────────────────────────────▼────────────────────────────────┐  │
│  │ const loadBumperProducts = async () => {                       │  │
│  │   for (const cartItem of cartItems) {                          │  │
│  │     // 1. Fetch cart item from Firebase                        │  │
│  │     const productRef = ref(database, `products/${cartItem.id}`)│  │
│  │     const snapshot = await get(productRef)                     │  │
│  │     const productData = snapshot.val()                         │  │
│  │                                                                 │  │
│  │     // 2. Get bumper products array                            │  │
│  │     const bumperProducts = productData.bumperProducts          │  │
│  │     const bumperMessage = productData.bumperMessage            │  │
│  │     const bumperCTA = productData.bumperCTA                    │  │
│  │                                                                 │  │
│  │     // 3. Fetch full details for each bumper                   │  │
│  │     for (const bumper of bumperProducts) {                     │  │
│  │       const bumperRef = ref(database, `products/${bumper.id}`) │  │
│  │       const bumperSnap = await get(bumperRef)                  │  │
│  │       // Store with custom message & CTA                       │  │
│  │     }                                                           │  │
│  │   }                                                             │  │
│  │ }                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ const handleAddBumper = (bumper) => {                          │  │
│  │   onAddBumper({           ─────┐                               │  │
│  │     id: bumper.id,              │                               │  │
│  │     name: bumper.title,         ├─ Callback to CheckoutPage    │  │
│  │     price: bumper.price,        │                               │  │
│  │     quantity: 1,                │                               │  │
│  │     isBumper: true        ◄─────┘                               │  │
│  │   })                                                            │  │
│  │ }                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
1. MERCHANT CONFIGURATION
   ┌─────────────────────┐
   │ Product Builder UI  │
   │ • Bumper message    │
   │ • Bumper CTA        │
   │ • Select products   │
   └──────────┬──────────┘
              │
              ▼ [Save]
   ┌─────────────────────┐
   │ Firebase Database   │
   │ products/           │
   │   product_123/      │
   │     bumperMessage   │
   │     bumperCTA       │
   │     bumperProducts[]│
   └─────────────────────┘

2. CUSTOMER SHOPPING
   ┌─────────────────────┐
   │ Add to Cart         │
   │ cart: [product_123] │
   └──────────┬──────────┘
              │
              ▼ [Checkout]
   ┌─────────────────────┐
   │ CheckoutPage        │
   │ cartItems=[...]     │
   └──────────┬──────────┘
              │
              ▼ [After Contact Info]
   ┌─────────────────────┐
   │ BumperProductWidget │
   └──────────┬──────────┘
              │
              ▼ [Load]

3. BUMPER LOADING
   ┌─────────────────────┐
   │ Firebase Query      │
   │ get(products/123)   │
   └──────────┬──────────┘
              │
              ▼ [Found bumpers]
   ┌─────────────────────┐
   │ Load Bumper Details │
   │ get(products/456)   │
   │ get(products/789)   │
   └──────────┬──────────┘
              │
              ▼ [Display]
   ┌─────────────────────┐
   │ Show Bumper Cards   │
   │ with custom message │
   └─────────────────────┘

4. CUSTOMER INTERACTION
   ┌─────────────────────┐
   │ Customer Clicks     │
   │ [+ Add to cart]     │
   └──────────┬──────────┘
              │
              ▼ [onAddBumper]
   ┌─────────────────────┐
   │ CheckoutPage        │
   │ handleAddBumper()   │
   └──────────┬──────────┘
              │
              ▼ [Update state]
   ┌─────────────────────┐
   │ Cart Updated        │
   │ cart: [             │
   │   product_123,      │
   │   product_456  ◄─┐  │
   │ ]                 └─ Added!
   └──────────┬──────────┘
              │
              ▼ [Recalculate]
   ┌─────────────────────┐
   │ Order Total Updated │
   │ £29.99 + £12.99     │
   │ = £42.98            │
   └─────────────────────┘
```

## State Management

```
┌───────────────────────────────────────────────────────────┐
│                    CHECKOUT PAGE STATE                     │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  cartItems: [                                             │
│    {                                                       │
│      id: "product_123",                                   │
│      name: "Premium Mirror",                              │
│      price: 29.99,                                        │
│      quantity: 1                                          │
│    }                                                       │
│  ]                                                         │
│                                                            │
│  ──── After bumper added ────                             │
│                                                            │
│  cartItems: [                                             │
│    {                                                       │
│      id: "product_123",                                   │
│      name: "Premium Mirror",                              │
│      price: 29.99,                                        │
│      quantity: 1                                          │
│    },                                                      │
│    {                                                       │
│      id: "product_456",        ◄── New!                  │
│      name: "Frame Kit",                                   │
│      price: 12.99,                                        │
│      quantity: 1,                                         │
│      isBumper: true           ◄── Tagged                 │
│    }                                                       │
│  ]                                                         │
│                                                            │
│  addedBumperIds: ["product_456"]  ◄── Track added        │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

## Firebase Data Structure

```
products/
│
├─ product_123/
│  ├─ title: "Premium Mirror"
│  ├─ price: 29.99
│  ├─ images: [...]
│  ├─ bumperMessage: "Want to add this for 20% off?" ◄──┐
│  ├─ bumperCTA: "Add to cart" ◄──────────────────────┐  │
│  └─ bumperProducts: [ ◄──────────────────────────┐   │  │
│       {                                           │   │  │
│         id: "product_456",                        │   │  │
│         title: "Frame Kit",                       │   │  │
│         price: 12.99                              │   │  │
│       },                                          │   │  │
│       {                                           │   │  │
│         id: "product_789",                        │   │  │
│         title: "LED Strip",                       │   │  │
│         price: 8.99                               │   │  │
│       }                                           │   │  │
│     ]                                             │   │  │
│                                                   │   │  │
├─ product_456/ ◄──────────────────────────────────┘   │  │
│  ├─ title: "Frame Kit"                                │  │
│  ├─ price: 12.99                                      │  │
│  └─ images: [...]                                     │  │
│                                                        │  │
└─ product_789/                                          │  │
   ├─ title: "LED Strip"                                │  │
   ├─ price: 8.99                                       │  │
   └─ images: [...]                                     │  │
                                                         │  │
        Widget loads:                                    │  │
        1. Full product details for each bumper         │  │
        2. Custom message from parent product ──────────┘  │
        3. Custom CTA from parent product ─────────────────┘
```

---

**Legend:**
- `─►` Data flow direction
- `◄─` Callback/return
- `▼` Sequential flow
- `┌─┐` Component/section boundary
- `│` Connection
- `✓` Completed action
- `◄──` Annotation/explanation
