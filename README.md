# ◈ NomaPay

> **A cross-border payment platform built on Arc Testnet.**
> Send USDC & EURC globally using just a .noma tag — no addresses, no friction, just payments.

![NomaPay](https://img.shields.io/badge/Network-Arc%20Testnet-00e5a0?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)
![Ethers](https://img.shields.io/badge/Ethers.js-6.16-2535a0?style=for-the-badge)
![Circle](https://img.shields.io/badge/Circle-API-0099ff?style=for-the-badge)

---

## What is NomaPay?

NomaPay turns your crypto wallet into a human-readable payment handle. Instead of copying and pasting long wallet addresses, users register a unique **.noma tag** and can instantly send or receive **USDC** and **EURC** stablecoins on Arc Testnet.

Built for the **Circle × Arc Stablecoins Commerce Stack Challenge — Track 1: Cross-Border Payments & Remittances**.

---

## Live Demo

🌐 **[nomapay.vercel.app](https://nomapay.vercel.app)**

---

## Features

-  **Wallet Connection** — Connect MetaMask and auto-switch to Arc Testnet
-  **.noma Tag Registration** — Register a unique username permanently linked to your wallet (0.50 USDC one-time fee)
-  **Multi-Currency Remittance** — Pay in 10+ currencies (AED, NGN, GHS, INR, PHP, PKR, GBP, KES, USD) with live FX rates
- 🇦🇪 **Pay in AED Mode** — Dedicated AED → USDC conversion flow (1 AED = 0.272 USDC)
-  **Bidirectional FX** — Flip any corridor (NGN→AED, GHS→USD, INR→GBP etc.)
-  **Send by .noma Tag** — Send USDC or EURC to any NomaPay user using just their tag
-  **Built-in FX Swap** — Swap between USDC and EURC directly in-app (0.2% fee)
-  **Payment Receipts** — Full receipt after every send with Arc explorer link and copy button
-  **Transaction History** — Persistent history per .noma tag, survives wallet disconnect
-  **Shareable Payment Links** — `nomapay.vercel.app/pay/username`
-  **Auto Balance Refresh** — Balances update every 30 seconds automatically
-  **Circle API** — Integrated and verifiable in Circle developer console
-  **Responsive UI** — Works on desktop and mobile

---

## Architecture

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
    ┌──────┴──────────────────────────────────────┐
    │                     │                       │
    ▼                     ▼                       ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│Vercel Function│  │  Circle API      │  │  Live FX Rates   │
│ /api/circle   │→ │api.circle.com    │  │open.er-api.com   │
│ Serverless    │  │/v1/w3s/wallets   │  │NGN GHS INR PHP   │
│ proxy layer   │  │Logged in console │  │AED GBP KES USD   │
└───────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Circle Products Used

| Product | Usage |
|---------|-------|
| **USDC on Arc** | Primary settlement rail for all remittances |
| **EURC on Arc** | Secondary stablecoin, swappable with USDC |
| **Circle API (W3S)** | Verified API integration, logged in Circle console |
| **Arc Testnet** | L1 blockchain purpose-built by Circle for stablecoin apps |

---

## Circle Product Feedback

### Why i chose these products
- **USDC on Arc** was the natural choice — Arc is purpose-built for stablecoin applications with dollar-denominated fees and deterministic finality. For a remittance app, predictable costs matter enormously.
- **EURC** gave us a second stable asset to power the built-in FX swap feature, allowing users to switch between dollar and euro denominated value.
- **Circle API (W3S)** let us verify our integration is real and traceable — judges and users can see actual API calls in Circle's console.

### What worked well
- Arc's sub-second finality made the UX feel like a Web2 app — users see their transaction confirmed almost instantly
- USDC's dollar denomination meant fee calculation was straightforward and predictable
- The Arc RPC was stable and reliable throughout development
- Circle's testnet infrastructure (faucets, explorer) made testing smooth

### What could be improved
- **Arc chain support in Modular Wallets SDK** — I couldn't use Circle's embedded wallet SDK because Arc isn't yet a supported chain. Adding Arc would unlock email-based onboarding without MetaMask
- **CCTP on Arc** — cross-chain USDC transfer to Arc from Ethereum/Solana would complete the full remittance story
- **Webhooks for on-chain events** — Circle webhooks that fire on USDC transfers on Arc would make received transaction notifications much more reliable than polling

---

## Supported Corridors

| From | To | Use Case |
|------|----|----------|
| 🇦🇪 AED | 🇳🇬 NGN | UAE expat → Nigeria |
| 🇦🇪 AED | 🇮🇳 INR | UAE expat → India |
| 🇦🇪 AED | 🇵🇭 PHP | UAE expat → Philippines |
| 🇦🇪 AED | 🇵🇰 PKR | UAE expat → Pakistan |
| 🇦🇪 AED | 🇬🇧 GBP | UAE → UK |
| 🇳🇬 NGN | 🇦🇪 AED | Nigeria → UAE |
| 🇬🇭 GHS | 🇺🇸 USD | Ghana → USA |
| 💵 USDC | 🌍 Any | Global USDC transfer |

---

## Revenue Model

| Action | Fee |
|--------|-----|
| .noma tag registration | 0.50 USDC (flat) |
| Send USDC / EURC | 0.5% of amount |
| Swap USDC ↔ EURC | 0.2% of amount |

---

## Smart Contract

**Deployed on Arc Testnet:**
```
0x7f88a72232860A77845Fa643B2941d1acC582bB7
```

**View on Explorer:**
[testnet.arcscan.app](https://testnet.arcscan.app/address/0x7f88a72232860A77845Fa643B2941d1acC582bB7)

### Contract Functions

| Function | Description |
|----------|-------------|
| `registerUsername(string)` | Register a .noma tag (charges 0.50 USDC) |
| `sendToUsername(string, address, uint256)` | Send tokens to a .noma tag (charges 0.5%) |
| `swap(address, uint256)` | Swap USDC ↔ EURC (charges 0.2%) |
| `getAddress(string)` | Resolve a .noma tag to a wallet address |
| `getUsername(address)` | Get the .noma tag for a wallet address |
| `isUsernameTaken(string)` | Check if a .noma tag is already registered |
| `withdrawFees(address, uint256)` | Owner only — withdraw accumulated fees |

---

## Token Addresses on Arc Testnet

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0x3600000000000000000000000000000000000000` | 6 |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |

---

## Arc Testnet Details

| Property | Value |
|----------|-------|
| Network Name | Arc Testnet |
| Chain ID | `5042002` (0x4cef52) |
| RPC URL | `https://rpc.testnet.arc.network` |
| Block Explorer | `https://testnet.arcscan.app` |
| Gas Token | USDC |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 5 |
| Wallet | MetaMask + ethers.js v6 |
| Smart Contract | Solidity 0.8.20 |
| Circle API | W3S Wallets via Vercel serverless |
| FX Rates | open.er-api.com (live) |
| Hosting | Vercel (frontend + serverless) |
| Network | Arc Testnet (Circle L1) |

---

## Running Locally

### Prerequisites
- Node.js v18+
- MetaMask browser extension
- Testnet USDC from [faucet.circle.com](https://faucet.circle.com)

### Steps

```bash
# Clone the repo
git clone https://github.com/Angelmykl/nomapay.git
cd nomapay

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add your Circle API keys to .env

# Start the dev server
npx vite --host 0.0.0.0

# Open in browser
http://localhost:5173
```

### Environment Variables

```
VITE_CIRCLE_CLIENT_KEY=your_circle_client_key
VITE_CIRCLE_API_KEY=your_circle_api_key
CIRCLE_API_KEY=your_circle_api_key
```

---

## Project Structure

```
nomapay/
├── api/
│   └── circle.js            ← Circle API serverless function
├── contract/
│   └── NomaPay.sol          ← Smart contract
├── scripts/
│   └── deployNode.mjs       ← Node.js deploy script
├── src/
│   ├── App.jsx              ← Main React app
│   ├── main.jsx             ← React entry point
│   └── index.css            ← CSS reset
├── index.html               ← HTML shell
├── vercel.json              ← Vercel routing config
├── vite.config.js           ← Vite config
└── .env                     ← API keys (never commit!)
```

---

## Security Notes

- ⚠️ This is a **testnet** deployment — do not use real funds
- The deployer private key is stored in `.env` — never commit this file
- The `.gitignore` already excludes `.env`

---

## License

MIT — feel free to fork and build on top of NomaPay.

---

Built with ◈ on Arc Testnet · Circle USDC · Track 1 — Cross-Border Payments & Remittances
