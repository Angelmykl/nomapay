# ◈ NomaPay

> **A cross-border payment platform built on Arc Testnet.**
> Send USDC & EURC globally using just a @nomatag — no addresses, no friction, just payments.

![NomaPay](https://img.shields.io/badge/Network-Arc%20Testnet-00e5a0?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)
![Ethers](https://img.shields.io/badge/Ethers.js-6.16-2535a0?style=for-the-badge)

---

## What is NomaPay?

NomaPay turns your crypto wallet into a human-readable payment handle. Instead of copying and pasting long wallet addresses, users register a unique **@nomatag** and can instantly send or receive **USDC** and **EURC** stablecoins on Arc Testnet — just like sending money on Venmo or Cash App, but fully on-chain.

---

## Live Demo

🌐 **[nomapay.vercel.app](https://nomapay.vercel.app)**

---

## Features

- 🔌 **Wallet Connection** — Connect MetaMask and auto-switch to Arc Testnet
- 👤 **@Nomatag Registration** — Register a unique username permanently linked to your wallet (0.50 USDC one-time fee)
- 💸 **Send by Nomatag** — Send USDC or EURC to any NomaPay user using just their @nomatag
- 🔄 **Built-in Swap** — Swap between USDC and EURC directly in-app (0.2% fee)
- 💰 **Live Balances** — Real-time USDC and EURC balances fetched directly from Arc Testnet
- 🔒 **Fully On-chain** — All username mappings and transfers are stored and executed on-chain
- 🔴 **Disconnect** — Full wallet disconnect including MetaMask permission revocation
- 📱 **Responsive UI** — Clean dark terminal aesthetic, works on desktop and mobile

---

## Revenue Model

NomaPay earns from every action on the platform:

| Action | Fee | Recipient |
|---|---|---|
| @Nomatag registration | 0.50 USDC (flat) | Contract owner |
| Send USDC / EURC | 0.5% of amount | Contract owner |
| Swap USDC ↔ EURC | 0.2% of amount | Contract owner |

The contract owner can withdraw accumulated fees anytime by calling `withdrawFees()`.

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
|---|---|
| `registerUsername(string)` | Register a @nomatag (charges 0.50 USDC) |
| `sendToUsername(string, address, uint256)` | Send tokens to a @nomatag (charges 0.5%) |
| `swap(address, uint256)` | Swap USDC ↔ EURC (charges 0.2%) |
| `getAddress(string)` | Resolve a @nomatag to a wallet address |
| `getUsername(address)` | Get the @nomatag for a wallet address |
| `isUsernameTaken(string)` | Check if a @nomatag is already registered |
| `withdrawFees(address, uint256)` | Owner only — withdraw accumulated fees |
| `setRegistrationFee(uint256)` | Owner only — update registration fee |
| `setTransferFeeBps(uint256)` | Owner only — update transfer fee (max 5%) |
| `setSwapFeeBps(uint256)` | Owner only — update swap fee (max 2%) |

---

## Token Addresses on Arc Testnet

| Token | Address | Decimals |
|---|---|---|
| USDC | `0x3600000000000000000000000000000000000000` | 6 |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |

---

## Arc Testnet Details

| Property | Value |
|---|---|
| Network Name | Arc Testnet |
| Chain ID | `5042002` (0x4cef52) |
| RPC URL | `https://rpc.testnet.arc.network` |
| Block Explorer | `https://testnet.arcscan.app` |
| Gas Token | USDC |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Wallet | MetaMask + ethers.js v6 |
| Smart Contract | Solidity 0.8.20 |
| Deployment | Node.js + solc (no Hardhat) |
| Hosting | Vercel |
| Network | Arc Testnet (EVM compatible) |

---

## Project Structure

```
nomapay/
├── contract/
│   └── NomaPay.sol          ← Smart contract
├── contracts/
│   └── NomaPay.sol          ← Hardhat copy (for compilation)
├── scripts/
│   ├── deploy.cjs           ← Hardhat deploy script
│   └── deployNode.mjs       ← Node.js deploy script (used)
├── src/
│   ├── App.jsx              ← Main React app
│   ├── main.jsx             ← React entry point
│   └── index.css            ← CSS reset
├── index.html               ← HTML shell
├── vite.config.js           ← Vite config
├── hardhat.config.cjs       ← Hardhat config
├── package.json             ← Dependencies
└── .env                     ← Private key (never commit!)
```

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
cd nomapay/nomapay

# Install dependencies
npm install

# Start the dev server
npx vite --host 0.0.0.0

# Open in browser
http://localhost:5173
```

---

## Deploying the Contract

```bash
# Create .env file with your deployer private key
echo "PRIVATE_KEY=0xYourPrivateKey" > .env

# Run the deploy script
node scripts/deployNode.mjs
```

Then update the `NOMAPAY_CONTRACT` address in `src/App.jsx`.

---

## Seeding Swap Liquidity

The swap feature requires the contract to hold both USDC and EURC. Send tokens directly to the contract address to enable swaps:

```
Contract: 0x7f88a72232860A77845Fa643B2941d1acC582bB7
```

Send both USDC and EURC to this address from your MetaMask wallet.

---

## Withdrawing Fees

Call `withdrawFees` from the owner wallet on the contract explorer:

- **token**: USDC or EURC address
- **amount**: amount in smallest unit (e.g. `1000000` = 1.00 USDC)

---

## Security Notes

- ⚠️ This is a **testnet** deployment — do not use real funds
- The deployer private key is stored in `.env` — never commit this file
- The `.gitignore` already excludes `.env`
- For mainnet, use a hardware wallet or multisig for the owner

---

## License

MIT — feel free to fork and build on top of NomaPay.

---

Built with ◈ on Arc Testnet
