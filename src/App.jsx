import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

// ─── Config ──────────────────────────────────────────────────────────────────
const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const NOMAPAY_CONTRACT = "0x7f88a72232860A77845Fa643B2941d1acC582bB7";
const USDC_ADDRESS     = "0x3600000000000000000000000000000000000000";
const EURC_ADDRESS     = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const RPC              = "https://rpc.testnet.arc.network";

// Circle API
const CIRCLE_API_BASE  = "/api";

// AED conversion rate
const AED_TO_USDC = 0.272;
const USDC_TO_AED = 3.674;

const CONTRACT_ABI = [
  "event TokenSent(string fromUsername, string toUsername, address token, uint256 amount, uint256 fee)",
  "function getUsername(address wallet) view returns (string)",
  "function registerUsername(string username)",
  "function sendToUsername(string toUsername, address token, uint256 amount)",
  "function swap(address fromToken, uint256 amount)",
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Supported currencies
const CURRENCIES = [
  { code: "USDC", name: "USD Coin",        flag: "💵", country: "Global" },
  { code: "USD",  name: "US Dollar",       flag: "🇺🇸", country: "USA" },
  { code: "AED",  name: "UAE Dirham",      flag: "🇦🇪", country: "UAE" },
  { code: "NGN",  name: "Nigerian Naira",  flag: "🇳🇬", country: "Nigeria" },
  { code: "GHS",  name: "Ghanaian Cedi",   flag: "🇬🇭", country: "Ghana" },
  { code: "INR",  name: "Indian Rupee",    flag: "🇮🇳", country: "India" },
  { code: "PHP",  name: "Philippine Peso", flag: "🇵🇭", country: "Philippines" },
  { code: "PKR",  name: "Pakistani Rupee", flag: "🇵🇰", country: "Pakistan" },
  { code: "GBP",  name: "British Pound",   flag: "🇬🇧", country: "UK" },
  { code: "KES",  name: "Kenyan Shilling", flag: "🇰🇪", country: "Kenya" },
];

const short   = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : "";
const timeAgo = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000)    return "just now";
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return `${Math.floor(d/86400000)}d ago`;
};
const fmtTime = (ts) => new Date(ts).toLocaleString();
const fmtNum  = (n, dec = 2) => Number(n).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Storage
const STORAGE_KEY  = (tag) => `noma_history_v3_${tag}`;
const saveHistory  = (tag, data) => { try { localStorage.setItem(STORAGE_KEY(tag), JSON.stringify(data)); } catch(e) {} };
const loadHistory  = (tag) => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY(tag)) || "[]"); } catch(e) { return []; } };
const clearHistory = (tag) => { try { localStorage.removeItem(STORAGE_KEY(tag)); } catch(e) {} };

// Circle API helper
const circleApi = async () => {
  try {
    const res = await fetch(`${CIRCLE_API_BASE}/circle`);
    return await res.json();
  } catch(e) { return null; }
};

export default function NomaPay() {
  const [account, setAccount]   = useState(null);
  const [username, setUsername] = useState("");
  const [tab, setTab]           = useState("send");
  const [step, setStep]         = useState("connect");

  const [sendTo, setSendTo]           = useState("");
  const [sendAmount, setSendAmount]   = useState("");
  const [sendToken, setSendToken]     = useState("USDC");
  const [sendStatus, setSendStatus]   = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // AED mode
  const [aedMode, setAedMode]     = useState(false);
  const [aedAmount, setAedAmount] = useState("");

  // Multi-currency FX mode
  const [fromCurrency, setFromCurrency] = useState(CURRENCIES[0]); // USDC
  const [toCurrency, setToCurrency]     = useState(CURRENCIES[2]);  // AED
  const [fxAmount, setFxAmount]         = useState("");
  const [fxRates, setFxRates]           = useState({});
  const [fxLoading, setFxLoading]       = useState(false);
  const [fxError, setFxError]           = useState(null);

  const [swapFrom, setSwapFrom]     = useState("USDC");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapStatus, setSwapStatus] = useState(null);

  const [regInput, setRegInput]     = useState("");
  const [regStatus, setRegStatus]   = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  const [usdcBal, setUsdcBal]       = useState("0.00");
  const [eurcBal, setEurcBal]       = useState("0.00");
  const [toast, setToast]           = useState(null);
  const [txHistory, setTxHistory]   = useState([]);
  const [showNotif, setShowNotif]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [circlePing, setCirclePing]     = useState(false);
  const [circleStatus, setCircleStatus] = useState("—");
  const [payLinkTag, setPayLinkTag]     = useState(null);

  const notifRef    = useRef(null);
  const tagRef      = useRef("");
  const accountRef  = useRef("");
  const intervalRef = useRef(null);

  // AED computed
  const aedToUsdc = aedAmount ? (parseFloat(aedAmount) * AED_TO_USDC).toFixed(2) : "";
  const effectiveSendAmount = aedMode ? aedToUsdc : sendAmount;

  // FX computed
  const getRate = (from, to) => {
    if (from === to) return 1;
    if (!fxRates || Object.keys(fxRates).length === 0) return null;
    // All rates are relative to USD
    // USDC = USD for our purposes
    const fromCode = from === "USDC" ? "USD" : from;
    const toCode   = to   === "USDC" ? "USD" : to;
    const fromRate = fxRates[fromCode] || 1;
    const toRate   = fxRates[toCode]   || 1;
    return toRate / fromRate;
  };

  const fxRate       = getRate(fromCurrency.code, toCurrency.code);
  const fxConverted  = fxAmount && fxRate ? (parseFloat(fxAmount) * fxRate).toFixed(2) : "";
  // How much USDC is being sent on-chain
  const usdRate      = getRate(fromCurrency.code, "USD");
  const fxUsdcAmount = fxAmount && usdRate ? (parseFloat(fxAmount) * usdRate).toFixed(4) : "";
  const fxFee        = fxUsdcAmount ? (parseFloat(fxUsdcAmount) * 0.005).toFixed(4) : "0";
  const fxNet        = fxUsdcAmount ? (parseFloat(fxUsdcAmount) - parseFloat(fxFee)).toFixed(4) : "0";

  // Send fee
  const sendFee = effectiveSendAmount && !isNaN(effectiveSendAmount) ? (parseFloat(effectiveSendAmount) * 0.005).toFixed(4) : "0";
  const sendNet = effectiveSendAmount && !isNaN(effectiveSendAmount) ? (parseFloat(effectiveSendAmount) - parseFloat(sendFee)).toFixed(4) : "0";

  const swapTo         = swapFrom === "USDC" ? "EURC" : "USDC";
  const swapNetPreview = swapAmount && !isNaN(swapAmount) ? (parseFloat(swapAmount)*0.998).toFixed(4) : null;
  const swapFeePreview = swapAmount && !isNaN(swapAmount) ? (parseFloat(swapAmount)*0.002).toFixed(4) : null;
  const payLink        = `${window.location.origin}/pay/${username}`;

  // Detect pay link
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/pay\/([a-z0-9_]+)$/);
    if (match) { setPayLinkTag(match[1]); setSendTo(match[1]); }
  }, []);

  // Close notif on outside click
  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ping Circle API on load
  useEffect(() => {
    const ping = async () => {
      const result = await circleApi();
      if (result?.success) { setCirclePing(true); setCircleStatus("Connected"); }
    };
    ping();
  }, []);

  // Fetch FX rates on load
  useEffect(() => {
    const fetchRates = async () => {
      setFxLoading(true);
      try {
        const res  = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (data?.rates) {
          setFxRates(data.rates);
          setFxError(null);
        }
      } catch(e) {
        setFxError("Using cached rates");
        // Fallback static rates
        setFxRates({
          USD:1, AED:3.674, NGN:1620, GHS:15.8,
          INR:83.5, PHP:57.8, PKR:278.5, GBP:0.79, KES:129.5
        });
      }
      setFxLoading(false);
    };
    fetchRates();
  }, []);

  // Balances
  const fetchBalances = async (addr) => {
    if (!addr) return;
    try {
      const p = new ethers.JsonRpcProvider(RPC);
      const [u, e] = await Promise.all([
        new ethers.Contract(USDC_ADDRESS, ERC20_ABI, p).balanceOf(addr),
        new ethers.Contract(EURC_ADDRESS, ERC20_ABI, p).balanceOf(addr),
      ]);
      setUsdcBal((Number(u) / 1e6).toFixed(2));
      setEurcBal((Number(e) / 1e6).toFixed(2));
    } catch(e) {}
  };

  // On-chain history
  const fetchOnChainHistory = async (tag) => {
  if (!tag) return;
  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const currentBlock = await provider.getBlockNumber();
    console.log("Current block:", currentBlock, "tag:", tag);
    const fromBlock = Math.max(0, currentBlock - 5000);

    const iface = new ethers.Interface([
      "event TokenSent(string fromUsername, string toUsername, address token, uint256 amount, uint256 fee)"
    ]);
    const topic = iface.getEvent("TokenSent").topicHash;

    const logs = await provider.getLogs({
      address: NOMAPAY_CONTRACT,
      topics: [topic],
      fromBlock: fromBlock,
      toBlock: "latest",
    });

    console.log("Raw logs found:", logs.length);
    if (logs.length > 0) console.log("First log data:", logs[0].data, "topics:", logs[0].topics);

    const existing    = loadHistory(tag);
    const existingIds = new Set(existing.map(t => t.id));
    const newEntries  = [];

    for (const log of logs.reverse()) {
      if (existingIds.has(log.transactionHash)) continue;
      try {
        
        // fromUsername and toUsername are indexed — decode from topics
const from = ethers.decodeBytes32String(log.topics[1]).replace(/\0/g, '') || 
  ethers.toUtf8String(ethers.getBytes(log.topics[1])).replace(/\0/g, '');
const to   = ethers.decodeBytes32String(log.topics[2]).replace(/\0/g, '') || 
  ethers.toUtf8String(ethers.getBytes(log.topics[2])).replace(/\0/g, '');
console.log("Decoded from topics:", from, "->", to);

// Decode data: address token, uint256 amount, uint256 fee
const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
  ["address", "uint256", "uint256"],
  log.data
);
if (from !== tag && to !== tag) continue;
let blockTime = Date.now();
try { const b = await provider.getBlock(log.blockNumber); if (b) blockTime = b.timestamp * 1000; } catch(e) {}
const tokenSym = decoded[0].toLowerCase() === USDC_ADDRESS.toLowerCase() ? "USDC" : "EURC";
newEntries.push({
  id: log.transactionHash, type: from === tag ? "sent" : "received",
  from, to,
  amount: (Number(decoded[1]) / 1e6).toFixed(2),
  fee:    (Number(decoded[2]) / 1e6).toFixed(4),
  token: tokenSym, time: blockTime,
  hash: log.transactionHash, unread: true,
});
      } catch(e) { console.log("Decode error:", e.message); continue; }
    }

    if (newEntries.length > 0) {
      const merged = [...newEntries, ...existing].slice(0, 100);
      setTxHistory(merged); saveHistory(tag, merged);
      setUnreadCount(c => c + newEntries.length);
    } else if (existing.length > 0) { setTxHistory(existing); }
  } catch(err) {
    console.error("fetchOnChainHistory error:", err.message);
    const saved = loadHistory(tag);
    if (saved.length > 0) setTxHistory(saved);
  }
};

  const startPolling = (addr, tag) => {
    accountRef.current = addr; tagRef.current = tag;
    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchBalances(addr); fetchOnChainHistory(tag);
    intervalRef.current = setInterval(() => {
      fetchBalances(accountRef.current); fetchOnChainHistory(tagRef.current);
    }, 30000);
  };

  const stopPolling = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  const enterApp = (addr, tag) => {
    setAccount(addr); setUsername(tag);
    tagRef.current = tag; accountRef.current = addr;
    const saved = loadHistory(tag);
    if (saved.length > 0) setTxHistory(saved);
    setStep("app"); startPolling(addr, tag);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Connect
  const connectWallet = async () => {
    if (!window.ethereum) { showToast("Please install MetaMask", "error"); return; }
    try {
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.chainId }] });
      } catch(se) {
        if (se.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET] });
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]); fetchBalances(accounts[0]);
      setStep("register"); showToast("Wallet connected!");
    } catch(err) { showToast("Connection failed: " + err.message, "error"); }
  };

  // Register
  const registerUsername = async () => {
    if (!regInput.trim()) return;
    if (!/^[a-z0-9_]{3,20}$/.test(regInput)) {
      setRegStatus({ type: "error", msg: "3–20 chars: lowercase, numbers, underscore only." }); return;
    }
    setRegLoading(true);
    setRegStatus({ type: "loading", msg: "Checking on-chain…" });
    try {
      const p  = new ethers.JsonRpcProvider(RPC);
      const ex = await new ethers.Contract(NOMAPAY_CONTRACT, CONTRACT_ABI, p).getUsername(account);
      if (ex && ex.length > 0) {
        localStorage.setItem(`nomapay_user_${account}`, ex);
        showToast(`Welcome back ${ex}.noma! 🎉`);
        enterApp(account, ex); setRegLoading(false); return;
      }
    } catch(e) {}
    setRegStatus({ type: "loading", msg: "Step 1/2 — Approve USDC fee…" });
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const signer = await p.getSigner();
      await (await new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer).approve(NOMAPAY_CONTRACT, ethers.parseUnits("0.5", 6))).wait();
      setRegStatus({ type: "loading", msg: "Step 2/2 — Registering .noma tag…" });
      const tx = await new ethers.Contract(NOMAPAY_CONTRACT, CONTRACT_ABI, signer).registerUsername(regInput);
      setRegStatus({ type: "loading", msg: "Confirming…" });
      await tx.wait();
      localStorage.setItem(`nomapay_user_${account}`, regInput);
      showToast(`${regInput}.noma registered! 🎉`);
      enterApp(account, regInput);
    } catch(err) { setRegStatus({ type: "error", msg: err.message }); }
    setRegLoading(false);
  };

  const addLocalTx = (tx) => {
    const entry = { ...tx, time: Date.now(), unread: false };
    setTxHistory(prev => {
      if (prev.find(t => t.id === entry.id)) return prev;
      const updated = [entry, ...prev].slice(0, 100);
      saveHistory(tagRef.current, updated); return updated;
    });
    setUnreadCount(c => c + 1);
  };

  // Send
  const executeSend = async () => {
    setShowConfirm(false);
    setSendStatus("pending");
    const sendTime = Date.now();
    try {
      const p      = new ethers.BrowserProvider(window.ethereum);
      const signer = await p.getSigner();
      const tAddr  = sendToken === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amt    = ethers.parseUnits(
        aedMode ? effectiveSendAmount : (fromCurrency.code === "USDC" ? sendAmount : fxUsdcAmount || sendAmount),
        6
      );
      await (await new ethers.Contract(tAddr, ERC20_ABI, signer).approve(NOMAPAY_CONTRACT, amt)).wait();
      const tx = await new ethers.Contract(NOMAPAY_CONTRACT, CONTRACT_ABI, signer).sendToUsername(sendTo, tAddr, amt);
      await tx.wait();
      circleApi();
      const usdcSent = aedMode ? effectiveSendAmount : (fxUsdcAmount || sendAmount);
      const fee = (parseFloat(usdcSent) * 0.005).toFixed(4);
      const net = (parseFloat(usdcSent) - parseFloat(fee)).toFixed(4);
      const receipt = {
        id: tx.hash, type: "sent", from: username, to: sendTo,
        amount: net, fee, token: sendToken, hash: tx.hash, time: sendTime,
        aedAmount: aedMode ? aedAmount : null,
        fxFrom: !aedMode && fromCurrency.code !== "USDC" ? `${fxAmount} ${fromCurrency.code}` : null,
        fxTo:   !aedMode && toCurrency.code !== "USDC"   ? toCurrency.code : null,
        usdcAmount: usdcSent,
      };
      addLocalTx(receipt);
      setShowReceipt(receipt);
      setSendAmount(""); setAedAmount(""); setFxAmount(""); setSendTo("");
      setSendStatus("done"); fetchBalances(account);
      setTimeout(() => setSendStatus(null), 2000);
    } catch(err) { showToast("Send failed: " + err.message, "error"); setSendStatus(null); }
  };

  // Swap
  const swapTokens = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) { showToast("Enter amount to swap", "error"); return; }
    setSwapStatus("pending");
    try {
      const p      = new ethers.BrowserProvider(window.ethereum);
      const signer = await p.getSigner();
      const fAddr  = swapFrom === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amt    = ethers.parseUnits(swapAmount, 6);
      await (await new ethers.Contract(fAddr, ERC20_ABI, signer).approve(NOMAPAY_CONTRACT, amt)).wait();
      const tx = await new ethers.Contract(NOMAPAY_CONTRACT, CONTRACT_ABI, signer).swap(fAddr, amt);
      await tx.wait();
      circleApi();
      const toToken = swapFrom === "USDC" ? "EURC" : "USDC";
      const net = (parseFloat(swapAmount) * 0.998).toFixed(4);
      addLocalTx({ id: tx.hash, type: "swap", from: swapFrom, to: toToken, amount: swapAmount, net, token: swapFrom, hash: tx.hash });
      showToast(`Swapped ${swapAmount} ${swapFrom} → ${net} ${toToken}`);
      setSwapAmount(""); setSwapStatus("done");
      fetchBalances(account);
      setTimeout(() => setSwapStatus(null), 2000);
    } catch(err) { showToast("Swap failed: " + err.message, "error"); setSwapStatus(null); }
  };

  // Flip FX currencies
  const flipCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFxAmount(fxConverted || "");
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  const C = { bg:"#080a0f", card:"#0f1117", border:"#1c2133", accent:"#00e5a0", accent2:"#0099ff", text:"#e8eaf2", muted:"#5a6478", error:"#ff5f5f", gold:"#ffc947" };
  const s = {
    root:{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Mono','Fira Code','Courier New',monospace", position:"relative", overflowX:"hidden" },
    bgGlow:{ position:"fixed", inset:0, background:`radial-gradient(ellipse 70% 40% at 15% 10%, rgba(0,229,160,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(0,153,255,0.06) 0%, transparent 55%)`, pointerEvents:"none", zIndex:0 },
    bgGrid:{ position:"fixed", inset:0, backgroundImage:`linear-gradient(${C.border} 1px, transparent 1px),linear-gradient(90deg,${C.border} 1px, transparent 1px)`, backgroundSize:"44px 44px", opacity:0.25, pointerEvents:"none", zIndex:0 },
    header:{ position:"relative", zIndex:20, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(14px)", background:"rgba(8,10,15,0.95)", flexWrap:"wrap", gap:8 },
    logo:{ display:"flex", alignItems:"center", gap:10 },
    logoMark:{ fontSize:20, color:C.accent },
    logoText:{ fontSize:17, fontWeight:700, letterSpacing:"0.04em" },
    logoSub:{ fontSize:9, background:"rgba(0,229,160,0.12)", color:C.accent, padding:"2px 7px", borderRadius:4, letterSpacing:"0.08em", textTransform:"uppercase" },
    circleBadge:{ fontSize:9, background:"rgba(0,153,255,0.12)", color:C.accent2, padding:"2px 7px", borderRadius:4, display:"flex", alignItems:"center", gap:4 },
    headerRight:{ display:"flex", alignItems:"center", gap:6 },
    pill:{ display:"flex", alignItems:"center", gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"5px 11px", fontSize:11, color:C.muted },
    dot:{ width:6, height:6, borderRadius:"50%", background:C.accent, boxShadow:`0 0 6px ${C.accent}`, flexShrink:0 },
    disconnectBtn:{ background:"rgba(255,95,95,0.1)", border:"1px solid rgba(255,95,95,0.3)", color:"#ff5f5f", borderRadius:20, padding:"5px 11px", fontSize:11, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
    bellWrap:{ position:"relative" },
    bellBtn:{ background:"rgba(0,229,160,0.08)", border:`1px solid ${C.border}`, borderRadius:20, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:15, position:"relative", flexShrink:0 },
    badge:{ position:"absolute", top:-4, right:-4, background:C.error, color:"#fff", borderRadius:"50%", width:17, height:17, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" },
    notifPanel:{ position:"fixed", top:64, right:12, width:"min(320px, calc(100vw - 24px))", background:C.card, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:"0 8px 40px rgba(0,0,0,0.6)", zIndex:500, overflow:"hidden" },
    notifHeader:{ padding:"13px 15px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" },
    notifTitle:{ fontSize:13, fontWeight:700 },
    notifClear:{ fontSize:11, color:C.muted, cursor:"pointer", background:"none", border:"none", fontFamily:"inherit" },
    notifList:{ maxHeight:"min(400px,65vh)", overflowY:"auto" },
    notifItem:{ padding:"11px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"flex-start", textDecoration:"none", color:"inherit" },
    notifIcon:{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 },
    notifBody:{ flex:1, minWidth:0 },
    notifMain:{ fontSize:12, fontWeight:600, marginBottom:2, wordBreak:"break-word" },
    notifSub:{ fontSize:11, color:C.muted },
    notifTime:{ fontSize:10, color:C.muted, marginTop:2 },
    notifLink:{ fontSize:10, color:C.accent, marginTop:3, display:"block" },
    notifEmpty:{ padding:"32px 16px", textAlign:"center", color:C.muted, fontSize:13 },
    center:{ position:"relative", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 64px)", padding:20 },
    card:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:"32px 26px", maxWidth:440, width:"100%", boxShadow:"0 0 80px rgba(0,229,160,0.03)" },
    logoIcon:{ fontSize:40, color:C.accent, textAlign:"center", marginBottom:10 },
    title:{ fontSize:30, fontWeight:800, textAlign:"center", letterSpacing:"-0.02em", margin:"0 0 8px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
    sub:{ textAlign:"center", color:C.muted, lineHeight:1.75, marginBottom:22, fontSize:13 },
    features:{ marginBottom:22 },
    feat:{ padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:10 },
    featIcon:{ color:C.accent },
    btnPrimary:{ width:"100%", padding:"13px 20px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, color:"#080a0f", border:"none", borderRadius:11, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
    btnOutline:{ flex:1, padding:"11px", background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:10, cursor:"pointer", fontFamily:"inherit", fontSize:13 },
    stepBadge:{ display:"inline-block", fontSize:10, color:C.accent, background:"rgba(0,229,160,0.1)", padding:"3px 9px", borderRadius:4, marginBottom:12, letterSpacing:"0.08em" },
    cardTitle:{ fontSize:19, fontWeight:700, margin:"0 0 7px" },
    cardSub:{ color:C.muted, fontSize:12, lineHeight:1.65, marginBottom:18 },
    inputWrap:{ display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:12, overflow:"hidden" },
    atSign:{ padding:"0 12px", color:C.accent, fontSize:16, fontWeight:700, borderRight:`1px solid ${C.border}`, height:46, display:"flex", alignItems:"center", flexShrink:0 },
    nomaTag:{ padding:"0 12px", color:C.muted, fontSize:12, borderLeft:`1px solid ${C.border}`, height:46, display:"flex", alignItems:"center", flexShrink:0 },
    input:{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:14, padding:"0 12px", height:46, fontFamily:"inherit", minWidth:0 },
    select:{ width:"100%", background:"transparent", border:"none", outline:"none", color:C.text, fontSize:11, padding:"2px 0", fontFamily:"inherit", cursor:"pointer", maxWidth:"100%" },
    feeBox:{ display:"flex", justifyContent:"space-between", background:"rgba(0,229,160,0.04)", border:`1px solid rgba(0,229,160,0.14)`, borderRadius:8, padding:"9px 13px", marginBottom:14, fontSize:12 },
    feeAmt:{ color:C.accent, fontWeight:600 },
    statusMsg:{ fontSize:12, marginBottom:12, lineHeight:1.5 },
    hint:{ textAlign:"center", color:C.muted, fontSize:10, marginTop:8 },
    previewTag:{ fontSize:11, color:C.accent, marginBottom:10, textAlign:"center" },
    appWrap:{ position:"relative", zIndex:10, maxWidth:520, margin:"0 auto", padding:"16px 12px 60px" },
    userBar:{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12, flexWrap:"wrap", gap:8 },
    userHandle:{ fontSize:15, fontWeight:700, color:C.accent },
    userAddr:{ fontSize:10, color:C.muted, marginTop:2 },
    tabs:{ display:"flex", gap:3, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:3, marginBottom:12 },
    tabBtn:{ flex:1, padding:"9px 4px", background:"transparent", border:"none", color:C.muted, cursor:"pointer", borderRadius:8, fontSize:11, fontFamily:"inherit" },
    tabActive:{ background:"rgba(0,229,160,0.1)", color:C.accent, fontWeight:600 },
    panel:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 14px" },
    panelTitle:{ fontSize:16, fontWeight:700, margin:"0 0 3px" },
    panelSub:{ color:C.muted, fontSize:11, marginBottom:14 },
    label:{ display:"block", fontSize:10, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.1em" },
    tokenToggle:{ display:"flex", gap:8, marginBottom:12 },
    tokenBtn:{ flex:1, padding:"10px 6px", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
    tokenBtnActive:{ border:`1px solid ${C.accent}`, color:C.accent, background:"rgba(0,229,160,0.07)" },
    amtWrap:{ display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:8, overflow:"hidden" },
    amtInput:{ fontSize:20, fontWeight:700, height:52 },
    amtToken:{ padding:"0 13px", color:C.muted, fontSize:12, borderLeft:`1px solid ${C.border}`, height:52, display:"flex", alignItems:"center", flexShrink:0 },
    feeRow:{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, padding:"3px 0" },
    feeRowNet:{ color:C.accent, fontWeight:600 },
    // FX selector styles
    fxBox:{ display:"flex", alignItems:"center", gap:8, marginBottom:12 },
    fxSide:{ flex:"1 1 0", minWidth:0, background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 8px", overflow:"hidden" },
    fxLabel:{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 },
    fxCurrencyRow:{ display:"flex", alignItems:"center", gap:6, marginBottom:6 },
    fxFlag:{ fontSize:16 },
    fxCode:{ fontSize:13, fontWeight:700 },
    fxName:{ fontSize:9, color:C.muted },
    fxInput:{ background:"transparent", border:"none", outline:"none", color:C.text, fontSize:18, fontWeight:700, width:"100%", fontFamily:"inherit" },
    fxOutput:{ fontSize:18, fontWeight:700, color:C.accent, minHeight:27 },
    fxArrow:{ width:36, height:36, borderRadius:"50%", background:"rgba(0,229,160,0.1)", border:`1px solid ${C.accent}`, color:C.accent, cursor:"pointer", fontSize:14, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
    fxRateBox:{ background:"rgba(0,153,255,0.05)", border:`1px solid rgba(0,153,255,0.15)`, borderRadius:8, padding:"8px 12px", marginBottom:10 },
    fxRateRow:{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"2px 0" },
    swapBox:{ display:"flex", alignItems:"center", gap:8, marginBottom:10 },
    swapSide:{ flex:1, background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" },
    swapLabel:{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 },
    swapToken:{ fontSize:12, fontWeight:600, marginBottom:6 },
    swapInput:{ height:36, fontSize:17, fontWeight:700, padding:0 },
    swapOutput:{ fontSize:17, fontWeight:700, color:C.accent, height:36, display:"flex", alignItems:"center" },
    swapArrow:{ width:36, height:36, borderRadius:"50%", background:"rgba(0,229,160,0.1)", border:`1px solid ${C.accent}`, color:C.accent, cursor:"pointer", fontSize:14, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
    swapNote:{ marginTop:12, padding:"9px 12px", background:"rgba(255,201,71,0.05)", border:`1px solid rgba(255,201,71,0.18)`, borderRadius:8, fontSize:11, color:"rgba(255,201,71,0.7)", lineHeight:1.55 },
    profileCard:{ textAlign:"center", padding:"18px 0 14px", borderBottom:`1px solid ${C.border}`, marginBottom:14 },
    avatar:{ width:54, height:54, borderRadius:"50%", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, color:"#080a0f", fontWeight:800, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" },
    profileName:{ fontSize:17, fontWeight:700, color:C.accent },
    profileAddr:{ fontSize:10, color:C.muted, marginTop:2, wordBreak:"break-all" },
    infoRow:{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 },
    infoKey:{ color:C.muted },
    contractBox:{ background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", marginTop:14 },
    contractLabel:{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 },
    contractAddr:{ fontSize:10, color:C.muted, wordBreak:"break-all" },
    payLinkBox:{ background:"rgba(0,229,160,0.04)", border:`1px solid rgba(0,229,160,0.2)`, borderRadius:8, padding:"10px 13px", marginTop:14 },
    payLinkLabel:{ fontSize:9, color:C.accent, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 },
    payLinkUrl:{ fontSize:10, color:C.text, wordBreak:"break-all", marginBottom:6 },
    copyBtn:{ fontSize:10, background:"rgba(0,229,160,0.1)", border:`1px solid ${C.accent}`, color:C.accent, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" },
    circleBox:{ background:"rgba(0,153,255,0.05)", border:`1px solid rgba(0,153,255,0.2)`, borderRadius:8, padding:"10px 13px", marginTop:14 },
    circleBoxTitle:{ fontSize:9, color:C.accent2, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 },
    aedBox:{ background:"rgba(255,201,71,0.05)", border:`1px solid rgba(255,201,71,0.2)`, borderRadius:10, padding:"12px 14px", marginBottom:12 },
    aedTitle:{ fontSize:10, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 },
    aedRow:{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", color:C.muted },
    aedVal:{ color:C.gold, fontWeight:600 },
    modeSwitcher:{ display:"flex", gap:6, marginBottom:14 },
    modeBtn:{ flex:1, padding:"8px 6px", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontSize:11, fontFamily:"inherit" },
    modeBtnActive:{ border:`1px solid ${C.gold}`, color:C.gold, background:"rgba(255,201,71,0.06)" },
    toast:{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"rgba(0,229,160,0.12)", border:`1px solid ${C.accent}`, color:C.accent, padding:"10px 20px", borderRadius:40, fontSize:12, fontWeight:600, zIndex:300, backdropFilter:"blur(12px)", whiteSpace:"nowrap", maxWidth:"calc(100vw - 32px)", overflow:"hidden", textOverflow:"ellipsis" },
    toastErr:{ background:"rgba(255,95,95,0.12)", border:`1px solid ${C.error}`, color:C.error },
    footer:{ position:"relative", zIndex:10, textAlign:"center", padding:"20px 20px 10px", color:C.muted, fontSize:10, letterSpacing:"0.07em", borderTop:`1px solid ${C.border}` },
    modal:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(8px)" },
    modalBox:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px 24px", maxWidth:380, width:"100%", boxShadow:"0 0 60px rgba(0,229,160,0.1)" },
    modalTitle:{ fontSize:16, fontWeight:700, marginBottom:18 },
    modalRow:{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 },
    modalKey:{ color:C.muted },
    modalBtns:{ display:"flex", gap:10, marginTop:20 },
    modalConfirm:{ flex:2, padding:"11px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, border:"none", color:"#080a0f", borderRadius:10, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:800 },
    receiptBox:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(12px)" },
    receiptCard:{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:18, padding:"28px 22px", maxWidth:380, width:"100%", boxShadow:`0 0 60px rgba(0,229,160,0.15)`, overflowY:"auto", maxHeight:"90vh" },
    receiptTitle:{ fontSize:28, textAlign:"center", marginBottom:4 },
    receiptSub:{ fontSize:13, color:C.accent, textAlign:"center", fontWeight:700, marginBottom:16 },
    receiptAmount:{ fontSize:30, fontWeight:800, textAlign:"center", color:C.accent, marginBottom:2 },
    receiptToken:{ fontSize:12, color:C.muted, textAlign:"center", marginBottom:16 },
    receiptRow:{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 },
    receiptKey:{ color:C.muted },
    receiptHash:{ fontSize:10, color:C.accent, wordBreak:"break-all", marginTop:8, cursor:"pointer", textDecoration:"underline" },
    receiptBtns:{ display:"flex", gap:10, marginTop:16 },
  };

  const getTxIcon = (type) => {
    if (type==="sent")     return { icon:"↗", bg:"rgba(255,95,95,0.15)",  color:"#ff5f5f" };
    if (type==="received") return { icon:"↙", bg:"rgba(0,229,160,0.15)",  color:C.accent };
    if (type==="swap")     return { icon:"⇄", bg:"rgba(0,153,255,0.15)",  color:C.accent2 };
    return                        { icon:"◈", bg:"rgba(0,229,160,0.15)",  color:C.accent };
  };

  const getTxLabel = (tx) => {
    if (tx.type==="sent")     return `Sent ${tx.amount} ${tx.token} to ${tx.to}.noma`;
    if (tx.type==="received") return `Received ${tx.amount} ${tx.token} from ${tx.from}.noma`;
    if (tx.type==="swap")     return `Swapped ${tx.amount} ${tx.token} → ${tx.net} ${tx.to}`;
    return "Transaction";
  };

  // Currency selector component
  const CurrencySelect = ({ value, onChange, label }) => (
    <div style={s.fxSide}>
      <div style={s.fxLabel}>{label}</div>
      <select style={s.select} value={value.code} onChange={e => onChange(CURRENCIES.find(c => c.code === e.target.value))}>
        {CURRENCIES.map(c => (
          <option key={c.code} value={c.code} style={{background:C.card}}>
            {c.flag} {c.code} — {c.country}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={s.root}>
      <div style={s.bgGlow}/><div style={s.bgGrid}/>
      {toast && <div style={{...s.toast,...(toast.type==="error"?s.toastErr:{})}}>{toast.type==="error"?"✗ ":"✓ "}{toast.msg}</div>}

      {/* Confirm Modal */}
      {showConfirm && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>Confirm Remittance</div>
            {aedMode && (
              <div style={{...s.aedBox, marginBottom:14}}>
                <div style={s.aedTitle}>AED Conversion</div>
                <div style={s.aedRow}><span>You pay</span><span style={s.aedVal}>{aedAmount} AED</span></div>
                <div style={s.aedRow}><span>Rate</span><span style={s.aedVal}>1 AED = {AED_TO_USDC} USDC</span></div>
                <div style={s.aedRow}><span>Converted</span><span style={s.aedVal}>{aedToUsdc} USDC</span></div>
              </div>
            )}
            {!aedMode && fromCurrency.code !== "USDC" && (
              <div style={{...s.aedBox, marginBottom:14}}>
                <div style={s.aedTitle}>FX Conversion</div>
                <div style={s.aedRow}><span>You pay</span><span style={s.aedVal}>{fxAmount} {fromCurrency.code}</span></div>
                <div style={s.aedRow}><span>Rate</span><span style={s.aedVal}>1 {fromCurrency.code} = {fxRate ? fxRate.toFixed(4) : "—"} {toCurrency.code}</span></div>
                <div style={s.aedRow}><span>Recipient gets</span><span style={s.aedVal}>{fxConverted} {toCurrency.code}</span></div>
                <div style={s.aedRow}><span>USDC on-chain</span><span style={s.aedVal}>{fxUsdcAmount} USDC</span></div>
              </div>
            )}
            {[
              ["Recipient",    `${sendTo}.noma`],
              ["USDC sent", `${aedMode ? effectiveSendAmount : (fromCurrency.code === "USDC" ? sendAmount : fxUsdcAmount)} USDC`],
              ["Fee (0.5%)",   `${sendFee} USDC`],
              ["They receive", `${aedMode ? sendNet : (fromCurrency.code === "USDC" ? sendNet : fxNet)} USDC`],
              ["Settlement",   "< 1 second on Arc"],
              ["Rail",         "USDC on Arc (Circle)"],
            ].map(([k,v]) => (
              <div key={k} style={s.modalRow}><span style={s.modalKey}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>
            ))}
            <div style={s.modalBtns}>
              <button style={s.btnOutline} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button style={s.modalConfirm} onClick={executeSend}>Confirm & Send →</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt */}
      {showReceipt && (
        <div style={s.receiptBox}>
          <div style={s.receiptCard}>
            <div style={s.receiptTitle}>✅</div>
            <div style={s.receiptSub}>Payment Sent Successfully</div>
            <div style={s.receiptAmount}>{showReceipt.amount}</div>
            <div style={s.receiptToken}>{showReceipt.token} · Settled on Arc via Circle USDC</div>
            {showReceipt.aedAmount && (
              <div style={{...s.aedBox, marginBottom:12}}>
                <div style={s.aedTitle}>AED Payment</div>
                <div style={s.aedRow}><span>Paid in AED</span><span style={s.aedVal}>{showReceipt.aedAmount} AED</span></div>
                <div style={s.aedRow}><span>Settled in USDC</span><span style={s.aedVal}>{showReceipt.usdcAmount} USDC</span></div>
              </div>
            )}
            {showReceipt.fxFrom && (
              <div style={{...s.aedBox, marginBottom:12}}>
                <div style={s.aedTitle}>FX Payment</div>
                <div style={s.aedRow}><span>Paid in</span><span style={s.aedVal}>{showReceipt.fxFrom}</span></div>
                <div style={s.aedRow}><span>Settled in USDC</span><span style={s.aedVal}>{showReceipt.usdcAmount} USDC</span></div>
              </div>
            )}
            {[
              ["From",       `${showReceipt.from}.noma`],
              ["To",         `${showReceipt.to}.noma`],
              ["Fee paid",   `${showReceipt.fee} ${showReceipt.token}`],
              ["Settled at", fmtTime(showReceipt.time)],
              ["Finality",   "< 1 second"],
              ["Powered by", "Circle USDC on Arc"],
            ].map(([k,v]) => (
              <div key={k} style={s.receiptRow}><span style={s.receiptKey}>{k}</span><span>{v}</span></div>
            ))}
            <a href={`https://testnet.arcscan.app/tx/${showReceipt.hash}`} target="_blank" rel="noreferrer" style={s.receiptHash}>
              View on Arc Explorer ↗ {showReceipt.hash?.slice(0,20)}…
            </a>
            <div style={s.receiptBtns}>
              <button style={s.btnOutline} onClick={() => setShowReceipt(null)}>Close</button>
              <button style={s.modalConfirm} onClick={() => {
                navigator.clipboard.writeText(`NomaPay Receipt\n${showReceipt.amount} ${showReceipt.token} sent to ${showReceipt.to}.noma\nFee: ${showReceipt.fee}\nSettled on Arc via Circle USDC\nTx: ${showReceipt.hash}`);
                showToast("Receipt copied!");
              }}>Copy Receipt</button>
            </div>
          </div>
        </div>
      )}

      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoMark}>◈</span>
          <span style={s.logoText}>NomaPay</span>
          <span style={s.logoSub}>on Arc Testnet</span>
          {circlePing && <span style={s.circleBadge}>● Circle API</span>}
        </div>
        {account && (
          <div style={s.headerRight}>
            <div style={s.bellWrap} ref={notifRef}>
              <div style={s.bellBtn} onClick={() => {
                setShowNotif(v => !v); setUnreadCount(0);
                setTxHistory(prev => { const u = prev.map(t=>({...t,unread:false})); saveHistory(tagRef.current,u); return u; });
              }}>
                🔔
                {unreadCount > 0 && <div style={s.badge}>{unreadCount > 9 ? "9+" : unreadCount}</div>}
              </div>
              {showNotif && (
                <div style={s.notifPanel}>
                  <div style={s.notifHeader}>
                    <span style={s.notifTitle}>Transaction History</span>
                    <button style={s.notifClear} onClick={() => { setTxHistory([]); clearHistory(tagRef.current); setShowNotif(false); }}>Clear all</button>
                  </div>
                  <div style={s.notifList}>
                    {txHistory.length === 0 ? <div style={s.notifEmpty}>No transactions yet</div>
                      : txHistory.map(tx => {
                          const { icon, bg, color } = getTxIcon(tx.type);
                          const url = tx.hash ? `https://testnet.arcscan.app/tx/${tx.hash}` : null;
                          return (
                            <a key={tx.id} href={url||"#"} target={url?"_blank":"_self"} rel="noreferrer"
                              style={{...s.notifItem, background:tx.unread?"rgba(0,229,160,0.04)":"transparent"}}>
                              <div style={{...s.notifIcon, background:bg, color}}>{icon}</div>
                              <div style={s.notifBody}>
                                <div style={s.notifMain}>{getTxLabel(tx)}</div>
                                {tx.fee && <div style={s.notifSub}>Fee: {tx.fee} {tx.token}</div>}
                                <div style={s.notifTime}>{timeAgo(tx.time)}</div>
                                {url && <span style={s.notifLink}>View on explorer ↗</span>}
                              </div>
                            </a>
                          );
                        })
                    }
                  </div>
                </div>
              )}
            </div>
            <div style={s.pill}><span style={s.dot}/>{short(account)}</div>
            <button style={s.disconnectBtn} onClick={async () => {
              stopPolling(); setAccount(null); setUsername(""); setStep("connect");
              setTxHistory([]); setUnreadCount(0); setShowNotif(false);
              if (window.ethereum) await window.ethereum.request({ method:"wallet_revokePermissions", params:[{eth_accounts:{}}] });
            }}>Disconnect</button>
          </div>
        )}
      </header>

      {/* CONNECT */}
      {step==="connect" && (
        <div style={s.center}>
          <div style={s.card}>
            <div style={s.logoIcon}>◈</div>
            <h1 style={s.title}>NomaPay</h1>
            <p style={{...s.sub, fontSize:12, color:C.accent, letterSpacing:"0.06em", marginBottom:6}}>CROSS-BORDER PAYMENTS ON ARC</p>
            <p style={s.sub}>Pay in AED, NGN, GHS, INR and more. Settle in USDC instantly. Send to anyone globally using just a .noma tag.</p>
            <div style={{display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:18}}>
              {["⚡ < 1s Settlement","🌍 10+ Currencies","🔒 USDC Native","💱 Live FX Rates","🔵 Circle API"].map(t => (
                <span key={t} style={{fontSize:10, background:"rgba(0,229,160,0.08)", border:"1px solid rgba(0,229,160,0.2)", color:C.accent, padding:"3px 9px", borderRadius:20}}>{t}</span>
              ))}
            </div>
            <div style={s.features}>
              {[
                ["◆","Pay in 10+ currencies — settle in USDC on Arc"],
                ["◆","Live FX rates — NGN, GHS, INR, PHP, PKR & more"],
                ["◆","Bidirectional — any currency to any currency"],
                ["◆","Username-based remittances (.noma tags)"],
                ["◆","Built-in USDC ↔ EURC swap"],
                ["◆","Circle API integrated · Verifiable on Arc"],
              ].map(([i,f])=>(
                <div key={f} style={s.feat}><span style={s.featIcon}>{i}</span>{f}</div>
              ))}
            </div>
            <button style={s.btnPrimary} onClick={connectWallet}>Connect Wallet →</button>
            <div style={{marginTop:12, textAlign:"center", fontSize:10, color:C.muted}}>
              Powered by <span style={{color:C.accent2}}>Circle USDC</span> on <span style={{color:C.accent}}>Arc Testnet</span>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER */}
      {step==="register" && (
        <div style={s.center}>
          <div style={s.card}>
            <div style={s.stepBadge}>NEW ACCOUNT</div>
            <h2 style={s.cardTitle}>Pick your .noma tag</h2>
            <p style={s.cardSub}>Your permanent payment identity on Arc. Anyone can send you USDC or EURC using yourname.noma</p>
            <div style={s.inputWrap}>
              <span style={s.atSign}>@</span>
              <input style={s.input} placeholder="yourname" value={regInput}
                onChange={e=>{setRegInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""));setRegStatus(null);}}
                onKeyDown={e=>e.key==="Enter"&&registerUsername()} maxLength={20}/>
              <span style={s.nomaTag}>.noma</span>
            </div>
            {regInput && <div style={s.previewTag}>Your tag: <strong>{regInput}.noma</strong></div>}
            <div style={s.feeBox}><span>Registration fee</span><span style={s.feeAmt}>0.50 USDC</span></div>
            {regStatus && <div style={{...s.statusMsg, color:regStatus.type==="error"?C.error:"#80d0a0"}}>{regStatus.msg}</div>}
            <button style={{...s.btnPrimary, opacity:regLoading?0.6:1}} onClick={registerUsername} disabled={regLoading}>
              {regLoading?"Processing…":"Create .noma Tag →"}
            </button>
            <p style={s.hint}>Lowercase · numbers · underscore · 3–20 chars</p>
          </div>
        </div>
      )}

      {/* APP */}
      {step==="app" && (
        <div style={s.appWrap}>
          {payLinkTag && (
            <div style={{background:"rgba(0,153,255,0.08)", border:`1px solid rgba(0,153,255,0.25)`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:C.accent2}}>
              💳 Payment request from <strong>{payLinkTag}.noma</strong>
            </div>
          )}
          <div style={s.userBar}>
            <div>
              <div style={s.userHandle}>{username}.noma</div>
              <div style={s.userAddr}>{short(account)}</div>
            </div>
            <div style={{display:"flex", gap:6}}>
              {[["USDC",usdcBal],["EURC",eurcBal]].map(([t,b])=>(
                <div key={t} style={{background:"#0b0d12",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",textAlign:"right"}}>
                  <div style={{fontSize:8,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t}</div>
                  <div style={{fontSize:12,fontWeight:600}}>{b}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.tabs}>
            {[["send","↗ Send"],["swap","⇄ Swap"],["profile","◉ Profile"]].map(([id,l])=>(
              <button key={id} style={{...s.tabBtn,...(tab===id?s.tabActive:{})}} onClick={()=>setTab(id)}>{l}</button>
            ))}
          </div>

          {/* SEND TAB */}
          {tab==="send" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Send Remittance</h3>
              <p style={s.panelSub}>Pay in any currency · Settle in USDC · Instant on Arc</p>

              {/* Mode switcher */}
              <label style={s.label}>Payment Mode</label>
              <div style={s.modeSwitcher}>
                <button style={{...s.modeBtn,...(!aedMode?s.modeBtnActive:{})}} onClick={() => setAedMode(false)}>
                  💵 Pay in USDC / FX
                </button>
                <button style={{...s.modeBtn,...(aedMode?s.modeBtnActive:{})}} onClick={() => setAedMode(true)}>
                  🇦🇪 Pay in AED
                </button>
              </div>

              {/* Recipient */}
              <label style={s.label}>Recipient .noma Tag</label>
              <div style={s.inputWrap}>
                <span style={s.atSign}>@</span>
                <input style={s.input} placeholder="nomatag" value={sendTo} onChange={e=>setSendTo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/>
                <span style={s.nomaTag}>.noma</span>
              </div>

              {/* AED MODE */}
              {aedMode ? (
                <>
                  <label style={s.label}>Amount in AED (د.إ)</label>
                  <div style={s.amtWrap}>
                    <input style={{...s.input,...s.amtInput}} placeholder="0.00" type="number" min="0"
                      value={aedAmount} onChange={e=>setAedAmount(e.target.value)}/>
                    <span style={s.amtToken}>AED</span>
                  </div>
                  {aedAmount && parseFloat(aedAmount) > 0 && (
                    <div style={s.aedBox}>
                      <div style={s.aedTitle}>AED → USDC Conversion</div>
                      <div style={s.aedRow}><span>You pay</span><span style={s.aedVal}>{aedAmount} AED</span></div>
                      <div style={s.aedRow}><span>Rate</span><span style={s.aedVal}>1 AED = {AED_TO_USDC} USDC</span></div>
                      <div style={s.aedRow}><span>Converted</span><span style={s.aedVal}>{aedToUsdc} USDC</span></div>
                      <div style={s.aedRow}><span>Fee (0.5%)</span><span style={{color:C.error}}>−{sendFee} USDC</span></div>
                      <div style={{...s.aedRow, marginTop:6, paddingTop:6, borderTop:`1px solid rgba(255,201,71,0.2)`}}>
                        <span style={{fontWeight:600}}>They receive</span>
                        <span style={{...s.aedVal, fontSize:13}}>{sendNet} USDC</span>
                      </div>
                      <div style={s.aedRow}><span>Settlement</span><span style={{color:C.accent}}>{"< 1 second on Arc"}</span></div>
                    </div>
                  )}
                </>
              ) : (
                /* FX / USDC MODE */
                <>
                  {/* Currency pair selector */}
                  <label style={s.label}>Currency Corridor</label>
                  <div style={s.fxBox}>
                    <div style={s.fxSide}>
                      <div style={s.fxLabel}>You pay in</div>
                      <select style={s.select} value={fromCurrency.code}
                        onChange={e => setFromCurrency(CURRENCIES.find(c => c.code === e.target.value))}>
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code} style={{background:C.card}}>
                            {c.flag} {c.code} — {c.country}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button style={s.fxArrow} onClick={flipCurrencies} title="Flip currencies">⇄</button>
                    <div style={s.fxSide}>
                      <div style={s.fxLabel}>They receive in</div>
                      <select style={s.select} value={toCurrency.code}
                        onChange={e => setToCurrency(CURRENCIES.find(c => c.code === e.target.value))}>
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code} style={{background:C.card}}>
                            {c.flag} {c.code} — {c.country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live rate display */}
                  {fxRate && fromCurrency.code !== toCurrency.code && (
                    <div style={s.fxRateBox}>
                      <div style={s.fxRateRow}>
                        <span style={{color:C.muted}}>Live rate</span>
                        <span style={{color:C.accent2, fontWeight:600}}>
                          1 {fromCurrency.code} = {fxLoading ? "..." : fmtNum(fxRate, 4)} {toCurrency.code}
                        </span>
                      </div>
                      <div style={s.fxRateRow}>
                        <span style={{color:C.muted}}>Settlement rail</span>
                        <span style={{color:C.accent}}>USDC on Arc</span>
                      </div>
                      {fxError && <div style={{...s.fxRateRow, color:"rgba(255,201,71,0.7)"}}><span>⚠ {fxError}</span></div>}
                    </div>
                  )}

                  {/* Amount input */}
                  <label style={s.label}>
                    Amount in {fromCurrency.flag} {fromCurrency.code}
                  </label>
                  <div style={s.fxBox}>
                    <div style={{...s.fxSide, flex:1}}>
                      <div style={s.fxLabel}>You send</div>
                      <input style={s.fxInput} placeholder="0.00" type="number" min="0"
                        value={fromCurrency.code === "USDC" ? sendAmount : fxAmount}
                        onChange={e => {
                          if (fromCurrency.code === "USDC") setSendAmount(e.target.value);
                          else setFxAmount(e.target.value);
                        }}/>
                      <div style={{fontSize:10, color:C.muted, marginTop:4}}>{fromCurrency.flag} {fromCurrency.code}</div>
                    </div>
                    <div style={{color:C.muted, fontSize:18, alignSelf:"center"}}>→</div>
                    <div style={{...s.fxSide, flex:1}}>
                      <div style={s.fxLabel}>They receive</div>
                      <div style={s.fxOutput}>
                        {fromCurrency.code === "USDC"
                          ? (sendAmount && fxRate ? fmtNum(parseFloat(sendAmount) * fxRate) : "0.00")
                          : (fxConverted ? fmtNum(parseFloat(fxConverted)) : "0.00")
                        }
                      </div>
                      <div style={{fontSize:10, color:C.muted, marginTop:4}}>{toCurrency.flag} {toCurrency.code}</div>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  {(fromCurrency.code === "USDC" ? sendAmount : fxAmount) && parseFloat(fromCurrency.code === "USDC" ? sendAmount : fxAmount) > 0 && (
                    <div style={{background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8}}>
                      <div style={{fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8}}>Fee Breakdown</div>
                      {fromCurrency.code !== "USDC" && (
                        <div style={s.feeRow}><span>USDC on-chain amount</span><span style={{color:C.accent2}}>{fxUsdcAmount} USDC</span></div>
                      )}
                      <div style={s.feeRow}><span>NomaPay fee (0.5%)</span><span style={{color:C.error}}>−{fromCurrency.code==="USDC"?sendFee:fxFee} USDC</span></div>
                      <div style={s.feeRow}><span>Gas on Arc</span><span style={{color:C.accent}}>~0.00 USDC</span></div>
                      <div style={{...s.feeRow,...s.feeRowNet, marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}`}}>
                        <span>Recipient gets</span>
                        <span>{fromCurrency.code==="USDC"?sendNet:fxNet} USDC</span>
                      </div>
                      <div style={s.feeRow}><span>Settlement</span><span style={{color:C.accent}}>{"< 1 second on Arc"}</span></div>
                    </div>
                  )}
                </>
              )}

              <button
                style={{...s.btnPrimary, marginTop:8, opacity:sendStatus==="pending"?0.5:1}}
                onClick={() => {
                  if (!sendTo) { showToast("Enter recipient","error"); return; }
                  const amt = aedMode ? aedToUsdc : (fromCurrency.code==="USDC" ? sendAmount : fxUsdcAmount);
                  if (!amt || parseFloat(amt)<=0) { showToast("Enter amount","error"); return; }
                  setShowConfirm(true);
                }}
                disabled={sendStatus==="pending"}
              >
                {sendStatus==="pending"?"Sending…":sendStatus==="done"?"✓ Sent!":"Review & Send →"}
              </button>
              <div style={{marginTop:10, textAlign:"center", fontSize:10, color:C.muted}}>
                Settled via <span style={{color:C.accent2}}>Circle USDC</span> on <span style={{color:C.accent}}>Arc Testnet</span>
              </div>
            </div>
          )}

          {/* SWAP TAB */}
          {tab==="swap" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>FX Swap</h3>
              <p style={s.panelSub}>USDC ↔ EURC · 1:1 rate · 0.2% fee · Instant on Arc</p>
              <div style={s.swapBox}>
                <div style={s.swapSide}>
                  <div style={s.swapLabel}>You pay</div>
                  <div style={s.swapToken}>{swapFrom==="USDC"?"💵":"💶"} {swapFrom}</div>
                  <input style={{...s.input,...s.swapInput}} placeholder="0.00" type="number" min="0" value={swapAmount} onChange={e=>setSwapAmount(e.target.value)}/>
                </div>
                <button style={s.swapArrow} onClick={()=>setSwapFrom(f=>f==="USDC"?"EURC":"USDC")}>⇄</button>
                <div style={s.swapSide}>
                  <div style={s.swapLabel}>You receive</div>
                  <div style={s.swapToken}>{swapTo==="USDC"?"💵":"💶"} {swapTo}</div>
                  <div style={s.swapOutput}>{swapNetPreview||"0.00"}</div>
                </div>
              </div>
              {swapFeePreview && (
                <div style={{background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", marginBottom:12}}>
                  <div style={s.feeRow}><span>Swap fee (0.2%)</span><span style={{color:C.error}}>−{swapFeePreview} {swapFrom}</span></div>
                  <div style={s.feeRow}><span>You receive</span><span style={{color:C.accent}}>{swapNetPreview} {swapTo}</span></div>
                  <div style={s.feeRow}><span>Settlement</span><span style={{color:C.accent}}>{"< 1 second on Arc"}</span></div>
                </div>
              )}
              <button style={{...s.btnPrimary, opacity:swapStatus==="pending"?0.6:1}} onClick={swapTokens} disabled={swapStatus==="pending"}>
                {swapStatus==="pending"?"Swapping…":swapStatus==="done"?"✓ Done!":`Swap ${swapFrom} → ${swapTo}`}
              </button>
              <div style={s.swapNote}>💡 Need EURC? Swap USDC → EURC here, then send globally to any .noma tag.</div>
            </div>
          )}

          {/* PROFILE TAB */}
          {tab==="profile" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Your profile</h3>
              <div style={s.profileCard}>
                <div style={s.avatar}>{username.slice(0,2).toUpperCase()}</div>
                <div style={s.profileName}>{username}.noma</div>
                <div style={s.profileAddr}>{account}</div>
              </div>
              {[
                ["Network",         "Arc Testnet (Circle L1)"],
                ["Noma Tag",        `${username}.noma`],
                ["Address",         short(account)],
                ["USDC Balance",    `${usdcBal} USDC`],
                ["EURC Balance",    `${eurcBal} EURC`],
                ["USDC (AED equiv)",`≈ ${(parseFloat(usdcBal) * USDC_TO_AED).toFixed(2)} AED`],
                ["Send Fee",        "0.5% per transfer"],
                ["Settlement",      "< 1 second on Arc"],
                ["FX Rates",        fxLoading ? "Loading…" : "Live · open.er-api.com"],
              ].map(([k,v])=>(
                <div key={k} style={s.infoRow}><span style={s.infoKey}>{k}</span><span>{v}</span></div>
              ))}
              <div style={s.payLinkBox}>
                <div style={s.payLinkLabel}>Your Payment Link</div>
                <div style={s.payLinkUrl}>{payLink}</div>
                <button style={s.copyBtn} onClick={() => { navigator.clipboard.writeText(payLink); showToast("Payment link copied!"); }}>
                  Copy Link
                </button>
              </div>
              <div style={s.circleBox}>
                <div style={s.circleBoxTitle}>Circle API Status</div>
                {[
                  ["API Connection", circlePing ? "✓ Connected" : "Connecting…"],
                  ["Status",         circleStatus],
                  ["Network",        "Arc Testnet"],
                  ["USDC Rail",      "Circle Native"],
                  ["EURC Rail",      "Circle Native"],
                ].map(([k,v])=>(
                  <div key={k} style={{...s.feeRow, padding:"4px 0"}}>
                    <span style={{color:C.muted}}>{k}</span>
                    <span style={{color:circlePing&&k==="API Connection"?C.accent:C.text}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={s.contractBox}>
                <div style={s.contractLabel}>NomaPay Contract</div>
                <div style={s.contractAddr}>{NOMAPAY_CONTRACT}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer style={s.footer}>
        <div>NomaPay · Built on Arc Testnet by Circle · USDC & EURC powered</div>
        <div style={{marginTop:4, color:C.accent2}}>Track 1 — Cross-Border Payments & Remittances ·</div>
        {circlePing && <div style={{marginTop:4, color:C.accent}}>● Circle API Connected</div>}
      </footer>
    </div>
  );
}
