# NomaPay — VS Code Setup Guide

## What's in this ZIP

```
nomapay/
├── src/
│   ├── App.jsx          ← Main React app (all UI + logic)
│   ├── main.jsx         ← React entry point
│   └── index.css        ← CSS reset
├── contract/
│   └── NomaPay.sol      ← Solidity smart contract
├── index.html           ← HTML shell
├── package.json         ← Dependencies
├── vite.config.js       ← Vite config
├── .env.example         ← Environment variable template
├── .gitignore
└── SETUP_GUIDE.md       ← This file
```

---

## PART 1 — Run the Frontend in VS Code

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher) — download and install it
- [VS Code](https://code.visualstudio.com) — download and install it
- [MetaMask](https://metamask.io) browser extension installed

### Step 1 — Open the project
1. Extract the ZIP file somewhere on your computer (e.g. Desktop)
2. Open VS Code
3. Click **File → Open Folder**
4. Select the `nomapay` folder you just extracted
5. Click **Open**

### Step 2 — Open the terminal inside VS Code
- Press `` Ctrl + ` `` (backtick) on Windows/Linux
- Or press `` Cmd + ` `` on Mac
- A terminal panel opens at the bottom

### Step 3 — Install dependencies
Type this in the terminal and press Enter:
```
npm install
```
Wait for it to finish (may take 1–2 minutes).

### Step 4 — Start the app
```
npm run dev
```
You'll see something like:
```
  VITE v5.x.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

### Step 5 — Open in browser
Open Chrome/Firefox and go to: **http://localhost:5173**

You should see the NomaPay app! It runs in demo mode (simulated transactions) until you deploy the contract and fill in the addresses.

---

## PART 2 — Deploy the Smart Contract (Remix IDE — No coding needed)

### Step 1 — Get Arc Testnet info
Search for "Arc Testnet" in their official docs to find:
- Chain ID
- RPC URL
- USDC contract address
- EURC contract address

### Step 2 — Add Arc Testnet to MetaMask
1. Open MetaMask → click the network dropdown at top
2. Click **Add Network → Add manually**
3. Fill in the Arc Testnet details you found above
4. Save and switch to it
5. Get some testnet ETH from their faucet (for gas)

### Step 3 — Deploy on Remix
1. Go to **https://remix.ethereum.org**
2. In the file explorer (left sidebar), click the **+** icon
3. Name it `NomaPay.sol`
4. Open the `contract/NomaPay.sol` file from VS Code and **copy all the text**
5. Paste it into Remix

### Step 4 — Compile
1. Click the **Solidity Compiler** icon (left sidebar, looks like `< >`)
2. Set compiler version to **0.8.20**
3. Click **Compile NomaPay.sol**
4. Green checkmark = success ✓

### Step 5 — Deploy
1. Click **Deploy & Run Transactions** icon (left sidebar, looks like Ethereum logo)
2. Set **Environment** to **Injected Provider - MetaMask**
3. MetaMask will pop up — approve the connection
4. Make sure you're on Arc Testnet in MetaMask
5. Fill in the constructor fields:
   - `_usdc`: paste the USDC address from Arc docs
   - `_eurc`: paste the EURC address from Arc docs
   - `_registrationFee`: `500000`  ← this is $0.50 (6 decimals)
   - `_transferFeeBps`: `50`       ← this is 0.5%
   - `_swapFeeBps`: `20`           ← this is 0.2%
6. Click **Deploy** and approve in MetaMask
7. Wait for the transaction to confirm
8. **Copy your deployed contract address** from the bottom of Remix (under "Deployed Contracts")

---

## PART 3 — Connect Frontend to Contract

### Step 1 — Update addresses in App.jsx
Open `src/App.jsx` in VS Code. Find these lines near the top:

```js
const NOMAPAY_CONTRACT = "0xYourDeployedContractAddress";
const USDC_ADDRESS     = "0xUSDCAddressOnArcTestnet";
const EURC_ADDRESS     = "0xEURCAddressOnArcTestnet";
```

Replace each placeholder with the real addresses.

Also update the Arc Testnet config above it with the real Chain ID and RPC URL:

```js
const ARC_TESTNET = {
  chainId: "0x____",           // Arc Testnet Chain ID in hex
  rpcUrls: ["https://____"],   // Arc Testnet RPC URL
  ...
};
```

### Step 2 — Enable real transactions
Inside `App.jsx`, find the `sendTokens`, `registerUsername`, and `swapTokens` functions.
Each has a commented-out block that says `── REAL IMPLEMENTATION ──`.

Uncomment those blocks and delete the demo code above them.
The `ethers` library is already installed — just uncomment `import { ethers } from "ethers"` at the top of the file.

### Step 3 — Restart the app
In VS Code terminal, press `Ctrl+C` to stop, then:
```
npm run dev
```

---

## PART 4 — Seed Swap Liquidity

For the swap to work, your contract needs to hold both USDC and EURC.

In Remix, under your deployed contract, find the contract address.
Transfer some USDC and EURC directly to that address using MetaMask (just send tokens to the contract address). These become the swap pool.

---

## Withdrawing Your Fees

In Remix (or any contract explorer), call `withdrawFees` with:
- `token`: USDC or EURC address
- `amount`: amount in smallest unit (e.g. `1000000` = 1.00 USDC)

This sends your accumulated fees to your wallet.

---

## Revenue Summary

| Action             | Your Cut         |
|--------------------|------------------|
| Register username  | 0.50 USDC flat   |
| Every send         | 0.5% of amount   |
| Every swap         | 0.2% of amount   |

---

## Recommended VS Code Extensions
- **ES7+ React/Redux/React-Native snippets** — helpful for React
- **Solidity** by Juan Blanco — syntax highlighting for .sol files
- **Prettier** — auto-formats your code

Install them in VS Code under Extensions (`Ctrl+Shift+X`).
