◈ NomaPay — Cross-Border Payments on Arc
> **Pay in AED, NGN, GHS, INR and more. Settle in USDC. Send to anyone globally using just a .noma tag.**
Live Demo: nomapay.vercel.app  
GitHub: github.com/Angelmykl/nomapay  
Track: Track 1 — Best Cross-Border Payments & Remittances Experience (UAE → Global)
---
What is NomaPay?
NomaPay is a cross-border stablecoin payment app built on Arc Testnet. It lets users send USDC and EURC globally using simple `.noma` username tags instead of wallet addresses — making crypto remittances as easy as sending a text message.
Users can pay in 10+ local currencies (AED, NGN, GHS, INR, PHP, PKR, GBP, KES, USD) with live FX rates, and the settlement happens instantly in USDC on Arc — sub-second finality, near-zero gas fees.
---
The Problem
Sending money across borders today is:
Slow (2–5 business days)
Expensive (5–10% fees)
Confusing (long account numbers, SWIFT codes)
Inaccessible (bank required)
The UAE has one of the world's largest expat populations. Workers from Nigeria, India, Philippines, Pakistan send billions home every year — paying high fees and waiting days for transfers to arrive.
---
The Solution
NomaPay uses USDC on Arc to provide:
Feature	Traditional	NomaPay
Settlement time	2–5 days	< 1 second
Fees	5–10%	0.5%
Identity	Bank account / IBAN	`.noma` username
Currencies	Limited	10+ with live FX
Availability	Banking hours	24/7
---
Features
🌍 Multi-Currency Remittance
Pay in AED, NGN, GHS, INR, PHP, PKR, GBP, KES, USD, USDC
Live FX rates fetched in real-time
Bidirectional — flip any corridor (NGN→AED, GHS→USD, INR→NGN, etc.)
Settlement always in USDC on Arc
🇦🇪 Pay in AED Mode
Dedicated AED → USDC conversion flow
1 AED = 0.272 USDC fixed rate
Full fee breakdown before every send
💰 .noma Username Tags
Register a permanent `.noma` identity (e.g. `john.noma`)
Send by username — no wallet addresses needed
Shareable payment links (`nomapay.vercel.app/pay/username`)
🔄 USDC ↔ EURC Swap
Built-in FX swap between Circle stablecoins
0.2% fee, instant settlement on Arc
🧾 Payment Receipts
Full receipt after every transaction
Corridor, amount, FX conversion, fee, timestamp
One-click copy + Arc explorer link
🔔 Transaction History
Persistent history per `.noma` tag
Shows sent, received, and swap transactions
Clickable — links directly to Arc explorer
Survives wallet disconnect/reconnect
⚡ Auto Balance Refresh
Balances update every 30 seconds automatically
Received tokens show without reconnecting
---
Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│         Browser · MetaMask Wallet · NomaPay React App       │
│                     (Deployed on Vercel)                    │
└───────────────┬─────────────────┬───────────────────────────┘
                │                 │                 │
                ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  ARC TESTNET — CIRCLE L1                    │
│       Chain ID: 0x4cef52 · Sub-second finality              │
│            Dollar-denominated fees · USDC native            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              NOMAPAY SMART CONTRACT                         │
│       0x7f88a72232860A77845Fa643B2941d1acC582bB7           │
│                                                             │
│  ┌──────────────────┐ ┌───────────────────┐ ┌───────────┐  │
│  │registerUsername()│ │sendToUsername()   │ │  swap()   │  │
│  │  0.5 USDC fee    │ │  0.5% fee         │ │ 0.2% fee  │  │
│  └──────────────────┘ └───────────────────┘ └───────────┘  │
└──────────┬──────────────────────────────────────┬───────────┘
           │                                      │
           ▼                                      ▼
┌──────────────────────┐              ┌───────────────────────┐
│    CIRCLE USDC       │              │     CIRCLE EURC       │
│  0x3600…0000         │              │   0x89B5…72a          │
│  Primary rail        │              │   FX swap rail        │
└──────────┬───────────┘              └───────────────────────┘
           │
    ┌──────┴──────────────┐
    │                     │                        │
    ▼                     ▼                        ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│Vercel Function│  │  Circle API      │  │  Live FX Rates   │
│ /api/circle   │→ │api.circle.com    │  │open.er-api.com   │
│ Serverless    │  │/v1/w3s/wallets   │  │NGN GHS INR PHP   │
│ proxy layer   │  │Logged in console │  │AED GBP KES USD   │
└───────────────┘  └──────────────────┘  └──────────────────┘
```
---
Circle Products Used
Product	Usage
USDC on Arc	Primary settlement rail for all remittances
EURC on Arc	Secondary stablecoin, swappable with USDC
Circle API (W3S)	Verified API integration, logged in Circle console
Arc Testnet	L1 blockchain purpose-built by Circle for stablecoin apps
---
Circle Product Feedback
Why we chose these products
USDC on Arc was the natural choice — Arc is purpose-built for stablecoin applications with dollar-denominated fees and deterministic finality. For a remittance app, predictable costs matter enormously.
EURC gave us a second stable asset to power the built-in FX swap feature, allowing users to switch between dollar and euro denominated value.
Circle API (W3S) let us verify our integration is real and traceable — judges and users can see actual API calls in Circle's console.
What worked well
Arc's sub-second finality made the UX feel like a Web2 app — users see their transaction confirmed almost instantly
USDC's dollar denomination meant fee calculation was straightforward and predictable
The Arc RPC was stable and reliable throughout development
Circle's testnet infrastructure (faucets, explorer) made testing smooth
What could be improved
Arc chain support in Modular Wallets SDK — we couldn't use Circle's embedded wallet SDK because Arc isn't yet a supported chain. Adding Arc would unlock email-based onboarding without MetaMask, which is critical for non-crypto-native remittance users
CCTP on Arc — cross-chain USDC transfer to Arc from Ethereum/Solana would complete the full remittance story (user deposits on Ethereum, receives on Arc)
Circle API documentation for W3S on Arc — more examples specific to Arc would help developers onboard faster
Webhooks for on-chain events — Circle webhooks that fire on USDC transfers on Arc would make received transaction notifications much more reliable than polling
Recommendations
Prioritize Arc support in the Modular Wallets SDK — this single feature would unlock consumer-grade remittance apps without requiring MetaMask
Add an Arc-specific quickstart guide to the Circle developer docs
Consider a Circle-native username/identity layer — `.noma` tags work but a Circle-native identity system would be more composable
---
Smart Contract
Address: `0x7f88a72232860A77845Fa643B2941d1acC582bB7`  
Network: Arc Testnet  
Explorer: testnet.arcscan.app
Functions
```solidity
registerUsername(string memory username)  // 0.5 USDC fee
sendToUsername(string memory toUsername, address token, uint256 amount)  // 0.5% fee
swap(address fromToken, uint256 amount)  // 0.2% fee
getUsername(address wallet) view returns (string)
isUsernameTaken(string memory username) view returns (bool)
withdrawFees()  // owner only
```
---
Setup & Run Locally
```bash
# Clone
git clone https://github.com/Angelmykl/nomapay.git
cd nomapay

# Install
npm install

# Create .env
cp .env.example .env
# Add your Circle API keys to .env

# Run
npx vite --host 0.0.0.0
```
Open `http://localhost:5173`
Environment Variables
```
VITE_CIRCLE_CLIENT_KEY=your_circle_client_key
VITE_CIRCLE_API_KEY=your_circle_api_key
CIRCLE_API_KEY=your_circle_api_key  # for serverless function
```
---
Supported Corridors
From	To	Use Case
🇦🇪 AED	🇳🇬 NGN	UAE expat → Nigeria
🇦🇪 AED	🇮🇳 INR	UAE expat → India
🇦🇪 AED	🇵🇭 PHP	UAE expat → Philippines
🇦🇪 AED	🇵🇰 PKR	UAE expat → Pakistan
🇦🇪 AED	🇬🇧 GBP	UAE → UK
🇳🇬 NGN	🇦🇪 AED	Nigeria → UAE
🇬🇭 GHS	🇺🇸 USD	Ghana → USA
💵 USDC	🌍 Any	Global USDC transfer
---
Tech Stack
Frontend: React + Vite
Blockchain: ethers.js v6
Network: Arc Testnet (Circle L1)
Tokens: USDC + EURC (Circle)
API: Circle W3S API
FX Rates: open.er-api.com (live)
Deployment: Vercel (frontend + serverless)
---
Team
Built solo for the Circle × Arc Stablecoins Commerce Stack Challenge.
---
NomaPay · Arc Testnet · USDC powered · Circle Developer Challenge 2025