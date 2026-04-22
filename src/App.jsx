import { useState, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";

// ─── Arc Testnet Config ─────────────────────────────────────────────────────
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

const short = (addr) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : "";
const timeAgo = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
};

export default function NomaPay() {
  const [account, setAccount]   = useState(null);
  const [username, setUsername] = useState("");
  const [tab, setTab]           = useState("send");
  const [step, setStep]         = useState("connect");

  const [sendTo, setSendTo]         = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken]   = useState("USDC");
  const [sendStatus, setSendStatus] = useState(null);

  const [swapFrom, setSwapFrom]     = useState("USDC");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapStatus, setSwapStatus] = useState(null);

  const [regInput, setRegInput]     = useState("");
  const [regStatus, setRegStatus]   = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  const [usdcBal, setUsdcBal] = useState("0.00");
  const [eurcBal, setEurcBal] = useState("0.00");
  const [toast, setToast]     = useState(null);

  const [txHistory, setTxHistory]     = useState([]);
  const [showNotif, setShowNotif]     = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addTx = (tx) => {
    setTxHistory(prev => [{ ...tx, id: `local_${Date.now()}`, time: Date.now(), unread: true }, ...prev].slice(0, 50));
    setUnreadCount(c => c + 1);
  };

  // Close notif when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── FIX 3: Auto-refresh balances + tx history every 30s ───────────────────
  useEffect(() => {
    if (!account || step !== "app") return;
    const userTag = localStorage.getItem(`nomapay_user_${account}`) || username;
    fetchBalances(account);
    if (userTag) fetchTxHistory(userTag);
    const interval = setInterval(() => {
      fetchBalances(account);
      if (userTag) fetchTxHistory(userTag);
    }, 30000);
    return () => clearInterval(interval);
  }, [account, step, username]);

  // ── FIX 3: Fetch Balances ──────────────────────────────────────────────────
  const fetchBalances = useCallback(async (address) => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const [uBal, eBal] = await Promise.all([
        new ethers.Contract(USDC_ADDRESS, abi, provider).balanceOf(address),
        new ethers.Contract(EURC_ADDRESS, abi, provider).balanceOf(address),
      ]);
      setUsdcBal((Number(uBal) / 1e6).toFixed(2));
      setEurcBal((Number(eBal) / 1e6).toFixed(2));
    } catch (err) { console.error("Balance fetch failed:", err); }
  }, []);

  // ── FIX 1: Fetch TX History (shows received + sent) ───────────────────────
  const fetchTxHistory = async (tag) => {
    if (!tag) return;
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, [
        "event TokenSent(string fromUsername, string toUsername, address token, uint256 amount, uint256 fee)",
      ], provider);

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      const allEvents = await contract.queryFilter("TokenSent", fromBlock);
      const txs = [];

      for (const e of allEvents.reverse().slice(0, 50)) {
        const from = e.args.fromUsername;
        const to   = e.args.toUsername;
        if (from !== tag && to !== tag) continue;

        const block = await provider.getBlock(e.blockNumber);
        const tokenSym = e.args.token.toLowerCase() === USDC_ADDRESS.toLowerCase() ? "USDC" : "EURC";

        txs.push({
          id: e.transactionHash,
          type: from === tag ? "sent" : "received",
          from, to,
          amount: (Number(e.args.amount) / 1e6).toFixed(2),
          fee:    (Number(e.args.fee)    / 1e6).toFixed(4),
          token: tokenSym,
          time: block ? block.timestamp * 1000 : Date.now(),
          hash: e.transactionHash,
          unread: false,
        });
      }
      setTxHistory(txs);
    } catch (err) { console.error("Tx history fetch failed:", err); }
  };

  // ── Connect Wallet ─────────────────────────────────────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) { showToast("Please install MetaMask", "error"); return; }
    try {
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.chainId }] });
      } catch (switchErr) {
        if (switchErr.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET] });
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      fetchBalances(accounts[0]);
      setStep("register");
      showToast("Wallet connected!");
    } catch (err) { showToast("Connection failed: " + err.message, "error"); }
  };

  // ── Register Username ──────────────────────────────────────────────────────
  const registerUsername = async () => {
    if (!regInput.trim()) return;
    if (!/^[a-z0-9_]{3,20}$/.test(regInput)) {
      setRegStatus({ type: "error", msg: "3–20 chars: lowercase letters, numbers, underscore only." });
      return;
    }
    setRegLoading(true);
    setRegStatus({ type: "loading", msg: "Checking registration…" });

    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function getUsername(address) view returns (string)"], provider);
      const existing = await contract.getUsername(account);
      if (existing && existing.length > 0) {
        localStorage.setItem(`nomapay_user_${account}`, existing);
        setUsername(existing);
        setStep("app");
        fetchTxHistory(existing);
        showToast(`Welcome back ${existing}.noma! 🎉`);
        setRegLoading(false);
        return;
      }
    } catch(e) {}

    setRegStatus({ type: "loading", msg: "Step 1/2 — Approve USDC fee…" });
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, ["function approve(address,uint256) returns(bool)"], signer);
      await (await usdc.approve(NOMAPAY_CONTRACT, ethers.parseUnits("0.5", 6))).wait();
      setRegStatus({ type: "loading", msg: "Step 2/2 — Registering .noma tag…" });
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function registerUsername(string)"], signer);
      const regTx = await contract.registerUsername(regInput);
      setRegStatus({ type: "loading", msg: "Confirming on-chain…" });
      await regTx.wait();
      localStorage.setItem(`nomapay_user_${account}`, regInput);
      setUsername(regInput);
      setStep("app");
      fetchTxHistory(regInput);
      addTx({ type: "registered", tag: regInput, hash: regTx.hash });
      showToast(`${regInput}.noma registered! 🎉`);
    } catch (err) { setRegStatus({ type: "error", msg: err.message }); }
    setRegLoading(false);
  };

  // ── Send Tokens ────────────────────────────────────────────────────────────
  const sendTokens = async () => {
    if (!sendTo || !sendAmount || parseFloat(sendAmount) <= 0) { showToast("Enter a recipient and amount", "error"); return; }
    setSendStatus("pending");
    try {
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const signer    = await provider.getSigner();
      const tokenAddr = sendToken === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amount    = ethers.parseUnits(sendAmount, 6);
      const token = new ethers.Contract(tokenAddr, ["function approve(address,uint256) returns(bool)"], signer);
      await (await token.approve(NOMAPAY_CONTRACT, amount)).wait();
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function sendToUsername(string,address,uint256)"], signer);
      const tx = await contract.sendToUsername(sendTo, tokenAddr, amount);
      await tx.wait();
      const fee = (parseFloat(sendAmount) * 0.005).toFixed(4);
      const net = (parseFloat(sendAmount) - parseFloat(fee)).toFixed(4);
      addTx({ type: "sent", from: username, to: sendTo, amount: net, fee, token: sendToken, hash: tx.hash });
      showToast(`Sent ${net} ${sendToken} to ${sendTo}.noma!`);
      setSendAmount(""); setSendTo("");
      setSendStatus("done");
      fetchBalances(account);
      setTimeout(() => setSendStatus(null), 2000);
    } catch (err) { showToast("Send failed: " + err.message, "error"); setSendStatus(null); }
  };

  // ── Swap Tokens ────────────────────────────────────────────────────────────
  const swapTokens = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) { showToast("Enter an amount to swap", "error"); return; }
    setSwapStatus("pending");
    try {
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const signer    = await provider.getSigner();
      const fromAddr  = swapFrom === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amount    = ethers.parseUnits(swapAmount, 6);
      const token = new ethers.Contract(fromAddr, ["function approve(address,uint256) returns(bool)"], signer);
      await (await token.approve(NOMAPAY_CONTRACT, amount)).wait();
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function swap(address,uint256)"], signer);
      const tx = await contract.swap(fromAddr, amount);
      await tx.wait();
      const toToken = swapFrom === "USDC" ? "EURC" : "USDC";
      const net = (parseFloat(swapAmount) * 0.998).toFixed(4);
      addTx({ type: "swap", from: swapFrom, to: toToken, amount: swapAmount, net, token: swapFrom, hash: tx.hash });
      showToast(`Swapped ${swapAmount} ${swapFrom} → ${net} ${toToken}`);
      setSwapAmount("");
      setSwapStatus("done");
      fetchBalances(account);
      setTimeout(() => setSwapStatus(null), 2000);
    } catch (err) { showToast("Swap failed: " + err.message, "error"); setSwapStatus(null); }
  };

  const swapTo         = swapFrom === "USDC" ? "EURC" : "USDC";
  const sendFeePreview = sendAmount && !isNaN(sendAmount) ? (parseFloat(sendAmount) * 0.005).toFixed(4) : null;
  const swapNetPreview = swapAmount && !isNaN(swapAmount) ? (parseFloat(swapAmount) * 0.998).toFixed(4) : null;
  const swapFeePreview = swapAmount && !isNaN(swapAmount) ? (parseFloat(swapAmount) * 0.002).toFixed(4) : null;

  // ─── Styles ────────────────────────────────────────────────────────────────
  const C = { bg:"#080a0f", card:"#0f1117", border:"#1c2133", accent:"#00e5a0", accent2:"#0099ff", text:"#e8eaf2", muted:"#5a6478", error:"#ff5f5f" };
  const s = {
    root:{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Mono','Fira Code','Courier New',monospace", position:"relative", overflowX:"hidden" },
    bgGlow:{ position:"fixed", inset:0, background:`radial-gradient(ellipse 70% 40% at 15% 10%, rgba(0,229,160,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(0,153,255,0.06) 0%, transparent 55%)`, pointerEvents:"none", zIndex:0 },
    bgGrid:{ position:"fixed", inset:0, backgroundImage:`linear-gradient(${C.border} 1px, transparent 1px),linear-gradient(90deg,${C.border} 1px, transparent 1px)`, backgroundSize:"44px 44px", opacity:0.25, pointerEvents:"none", zIndex:0 },
    // FIX 4: Header uses flexWrap so it works on mobile
    header:{ position:"relative", zIndex:20, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(14px)", background:"rgba(8,10,15,0.95)", flexWrap:"wrap", gap:8 },
    logo:{ display:"flex", alignItems:"center", gap:10 },
    logoMark:{ fontSize:20, color:C.accent },
    logoText:{ fontSize:17, fontWeight:700, letterSpacing:"0.04em" },
    logoSub:{ fontSize:9, background:"rgba(0,229,160,0.12)", color:C.accent, padding:"2px 7px", borderRadius:4, letterSpacing:"0.08em", textTransform:"uppercase" },
    headerRight:{ display:"flex", alignItems:"center", gap:6 },
    pill:{ display:"flex", alignItems:"center", gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"5px 11px", fontSize:11, color:C.muted },
    dot:{ width:6, height:6, borderRadius:"50%", background:C.accent, boxShadow:`0 0 6px ${C.accent}`, flexShrink:0 },
    disconnectBtn:{ background:"rgba(255,95,95,0.1)", border:"1px solid rgba(255,95,95,0.3)", color:"#ff5f5f", borderRadius:20, padding:"5px 11px", fontSize:11, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
    bellWrap:{ position:"relative" },
    bellBtn:{ background:"rgba(0,229,160,0.08)", border:`1px solid ${C.border}`, borderRadius:20, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:15, position:"relative", flexShrink:0 },
    badge:{ position:"absolute", top:-4, right:-4, background:C.error, color:"#fff", borderRadius:"50%", width:17, height:17, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" },
    // FIX 4: Notif panel uses position:fixed so it never hides on mobile or small screens
    notifPanel:{ position:"fixed", top:64, right:12, width:"min(320px, calc(100vw - 24px))", background:C.card, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:"0 8px 40px rgba(0,0,0,0.6)", zIndex:500, overflow:"hidden" },
    notifHeader:{ padding:"13px 15px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" },
    notifTitle:{ fontSize:13, fontWeight:700 },
    notifClear:{ fontSize:11, color:C.muted, cursor:"pointer", background:"none", border:"none", fontFamily:"inherit" },
    notifList:{ maxHeight:"min(400px, 65vh)", overflowY:"auto" },
    // FIX 2: notifItem is an <a> tag — make it look clickable
    notifItem:{ padding:"11px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", textDecoration:"none", color:"inherit" },
    notifIcon:{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 },
    notifBody:{ flex:1, minWidth:0 },
    notifMain:{ fontSize:12, fontWeight:600, marginBottom:2, wordBreak:"break-word" },
    notifSub:{ fontSize:11, color:C.muted },
    notifTime:{ fontSize:10, color:C.muted, marginTop:2 },
    notifLink:{ fontSize:10, color:C.accent, marginTop:3, display:"block" },
    notifEmpty:{ padding:"32px 16px", textAlign:"center", color:C.muted, fontSize:13 },
    center:{ position:"relative", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 64px)", padding:20 },
    card:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:"32px 26px", maxWidth:420, width:"100%", boxShadow:"0 0 80px rgba(0,229,160,0.03)" },
    logoIcon:{ fontSize:40, color:C.accent, textAlign:"center", marginBottom:10 },
    title:{ fontSize:30, fontWeight:800, textAlign:"center", letterSpacing:"-0.02em", margin:"0 0 8px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
    sub:{ textAlign:"center", color:C.muted, lineHeight:1.75, marginBottom:22, fontSize:13 },
    features:{ marginBottom:22 },
    feat:{ padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:10 },
    featIcon:{ color:C.accent },
    btnPrimary:{ width:"100%", padding:"13px 20px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, color:"#080a0f", border:"none", borderRadius:11, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
    stepBadge:{ display:"inline-block", fontSize:10, color:C.accent, background:"rgba(0,229,160,0.1)", padding:"3px 9px", borderRadius:4, marginBottom:12, letterSpacing:"0.08em" },
    cardTitle:{ fontSize:19, fontWeight:700, margin:"0 0 7px" },
    cardSub:{ color:C.muted, fontSize:12, lineHeight:1.65, marginBottom:18 },
    inputWrap:{ display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:12, overflow:"hidden" },
    atSign:{ padding:"0 12px", color:C.accent, fontSize:16, fontWeight:700, borderRight:`1px solid ${C.border}`, height:46, display:"flex", alignItems:"center", flexShrink:0 },
    nomaTag:{ padding:"0 12px", color:C.muted, fontSize:12, borderLeft:`1px solid ${C.border}`, height:46, display:"flex", alignItems:"center", flexShrink:0 },
    input:{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:14, padding:"0 12px", height:46, fontFamily:"inherit", minWidth:0 },
    feeBox:{ display:"flex", justifyContent:"space-between", background:"rgba(0,229,160,0.04)", border:`1px solid rgba(0,229,160,0.14)`, borderRadius:8, padding:"9px 13px", marginBottom:14, fontSize:12 },
    feeAmt:{ color:C.accent, fontWeight:600 },
    statusMsg:{ fontSize:12, marginBottom:12, lineHeight:1.5 },
    hint:{ textAlign:"center", color:C.muted, fontSize:10, marginTop:8 },
    previewTag:{ fontSize:11, color:C.accent, marginBottom:10, textAlign:"center" },
    appWrap:{ position:"relative", zIndex:10, maxWidth:500, margin:"0 auto", padding:"16px 12px 60px" },
    userBar:{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12, flexWrap:"wrap", gap:8 },
    userHandle:{ fontSize:15, fontWeight:700, color:C.accent },
    userAddr:{ fontSize:10, color:C.muted, marginTop:2 },
    tabs:{ display:"flex", gap:3, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:3, marginBottom:12 },
    tabBtn:{ flex:1, padding:"9px 4px", background:"transparent", border:"none", color:C.muted, cursor:"pointer", borderRadius:8, fontSize:12, fontFamily:"inherit" },
    tabActive:{ background:"rgba(0,229,160,0.1)", color:C.accent, fontWeight:600 },
    panel:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 14px" },
    panelTitle:{ fontSize:16, fontWeight:700, margin:"0 0 3px" },
    panelSub:{ color:C.muted, fontSize:11, marginBottom:14 },
    label:{ display:"block", fontSize:10, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.1em" },
    tokenToggle:{ display:"flex", gap:8, marginBottom:12 },
    tokenBtn:{ flex:1, padding:"10px 6px", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
    tokenBtnActive:{ border:`1px solid ${C.accent}`, color:C.accent, background:"rgba(0,229,160,0.07)" },
    amtWrap:{ display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:6, overflow:"hidden" },
    amtInput:{ fontSize:20, fontWeight:700, height:52 },
    amtToken:{ padding:"0 13px", color:C.muted, fontSize:12, borderLeft:`1px solid ${C.border}`, height:52, display:"flex", alignItems:"center", flexShrink:0 },
    feeRow:{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, padding:"3px 0" },
    feeRowNet:{ color:C.accent, fontWeight:600 },
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
    toast:{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"rgba(0,229,160,0.12)", border:`1px solid ${C.accent}`, color:C.accent, padding:"10px 20px", borderRadius:40, fontSize:12, fontWeight:600, zIndex:300, backdropFilter:"blur(12px)", whiteSpace:"nowrap", maxWidth:"calc(100vw - 32px)", overflow:"hidden", textOverflow:"ellipsis" },
    toastErr:{ background:"rgba(255,95,95,0.12)", border:`1px solid ${C.error}`, color:C.error },
    footer:{ position:"relative", zIndex:10, textAlign:"center", padding:"20px", color:C.muted, fontSize:10, letterSpacing:"0.07em", borderTop:`1px solid ${C.border}` },
  };

  const getTxIcon = (type) => {
    if (type === "sent")       return { icon:"↗", bg:"rgba(255,95,95,0.15)",  color:"#ff5f5f" };
    if (type === "received")   return { icon:"↙", bg:"rgba(0,229,160,0.15)",  color:C.accent };
    if (type === "swap")       return { icon:"⇄", bg:"rgba(0,153,255,0.15)",  color:C.accent2 };
    return                            { icon:"◈", bg:"rgba(0,229,160,0.15)",  color:C.accent };
  };

  const getTxLabel = (tx) => {
    if (tx.type === "sent")       return `Sent ${tx.amount} ${tx.token} to ${tx.to}.noma`;
    if (tx.type === "received")   return `Received ${tx.amount} ${tx.token} from ${tx.from}.noma`;
    if (tx.type === "swap")       return `Swapped ${tx.amount} ${tx.token} → ${tx.net} ${tx.to}`;
    if (tx.type === "registered") return `Registered ${tx.tag}.noma`;
    return "Transaction";
  };

  return (
    <div style={s.root}>
      <div style={s.bgGlow}/><div style={s.bgGrid}/>
      {toast && <div style={{...s.toast,...(toast.type==="error"?s.toastErr:{})}}>{toast.type==="error"?"✗ ":"✓ "}{toast.msg}</div>}

      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoMark}>◈</span>
          <span style={s.logoText}>NomaPay</span>
          <span style={s.logoSub}>on Arc Testnet</span>
        </div>
        {account && (
          <div style={s.headerRight}>
            {/* 🔔 Bell — FIX 4: panel uses position:fixed */}
            <div style={s.bellWrap} ref={notifRef}>
              <div style={s.bellBtn} onClick={() => {
                setShowNotif(v => !v);
                setUnreadCount(0);
                setTxHistory(prev => prev.map(t => ({...t, unread:false})));
              }}>
                🔔
                {unreadCount > 0 && <div style={s.badge}>{unreadCount > 9 ? "9+" : unreadCount}</div>}
              </div>

              {showNotif && (
                <div style={s.notifPanel}>
                  <div style={s.notifHeader}>
                    <span style={s.notifTitle}>Transaction History</span>
                    <button style={s.notifClear} onClick={() => { setTxHistory([]); setShowNotif(false); }}>Clear all</button>
                  </div>
                  <div style={s.notifList}>
                    {txHistory.length === 0 ? (
                      <div style={s.notifEmpty}>No transactions yet</div>
                    ) : txHistory.map((tx) => {
                      const { icon, bg, color } = getTxIcon(tx.type);
                      // FIX 2: entire row is a clickable link to explorer
                      const explorerUrl = tx.hash ? `https://testnet.arcscan.app/tx/${tx.hash}` : null;
                      return (
                        <a
                          key={tx.id}
                          href={explorerUrl || "#"}
                          target={explorerUrl ? "_blank" : "_self"}
                          rel="noreferrer"
                          style={{ ...s.notifItem, background: tx.unread ? "rgba(0,229,160,0.04)" : "transparent" }}
                        >
                          <div style={{...s.notifIcon, background:bg, color}}>{icon}</div>
                          <div style={s.notifBody}>
                            <div style={s.notifMain}>{getTxLabel(tx)}</div>
                            {tx.fee && <div style={s.notifSub}>Fee: {tx.fee} {tx.token}</div>}
                            <div style={s.notifTime}>{timeAgo(tx.time)}</div>
                            {explorerUrl && <span style={s.notifLink}>View on explorer ↗</span>}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={s.pill}><span style={s.dot}/>{short(account)}</div>
            <button style={s.disconnectBtn} onClick={async () => {
              setAccount(null); setUsername(""); setStep("connect");
              setTxHistory([]); setUnreadCount(0);
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
            <p style={{...s.sub, fontSize:12, color:C.accent, letterSpacing:"0.06em", marginBottom:6}}>WELCOME TO NOMAPAY</p>
            <p style={s.sub}>A cross-border payment platform built on Arc Testnet. Send USDC & EURC globally using just a .noma tag — no addresses, no friction, just payments.</p>
            <div style={{display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:18}}>
              {["⚡ Instant","🌍 Cross-border","🔒 On-chain","💵 USDC & EURC"].map(tag => (
                <span key={tag} style={{fontSize:10, background:"rgba(0,229,160,0.08)", border:"1px solid rgba(0,229,160,0.2)", color:C.accent, padding:"3px 9px", borderRadius:20}}>{tag}</span>
              ))}
            </div>
            <div style={s.features}>
              {[["◆","Username-based payments"],["◆","USDC & EURC support"],["◆","Built-in token swap"],["◆","Arc Testnet native"],["◆","0.5% fee per send"]].map(([icon,f])=>(
                <div key={f} style={s.feat}><span style={s.featIcon}>{icon}</span>{f}</div>
              ))}
            </div>
            <button style={s.btnPrimary} onClick={connectWallet}>Connect Wallet →</button>
          </div>
        </div>
      )}

      {/* REGISTER */}
      {step==="register" && (
        <div style={s.center}>
          <div style={s.card}>
            <div style={s.stepBadge}>NEW ACCOUNT</div>
            <h2 style={s.cardTitle}>Pick your .noma tag</h2>
            <p style={s.cardSub}>This is permanent and tied to your wallet. People send you money using yourname.noma</p>
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
          <div style={s.userBar}>
            <div>
              <div style={s.userHandle}>{username}.noma</div>
              <div style={s.userAddr}>{short(account)}</div>
            </div>
            <div style={{display:"flex", gap:6}}>
              {[["USDC",usdcBal],["EURC",eurcBal]].map(([t,bal])=>(
                <div key={t} style={{background:"#0b0d12",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",textAlign:"right"}}>
                  <div style={{fontSize:8,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t}</div>
                  <div style={{fontSize:12,fontWeight:600}}>{bal}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.tabs}>
            {[["send","↗ Send"],["swap","⇄ Swap"],["profile","◉ Profile"]].map(([id,label])=>(
              <button key={id} style={{...s.tabBtn,...(tab===id?s.tabActive:{})}} onClick={()=>setTab(id)}>{label}</button>
            ))}
          </div>

          {tab==="send" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Send to .noma tag</h3>
              <p style={s.panelSub}>Send to any NomaPay user instantly</p>
              <label style={s.label}>Recipient</label>
              <div style={s.inputWrap}>
                <span style={s.atSign}>@</span>
                <input style={s.input} placeholder="nomatag" value={sendTo}
                  onChange={e=>setSendTo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/>
                <span style={s.nomaTag}>.noma</span>
              </div>
              <label style={s.label}>Token</label>
              <div style={s.tokenToggle}>
                {["USDC","EURC"].map(t=>(
                  <button key={t} style={{...s.tokenBtn,...(sendToken===t?s.tokenBtnActive:{})}} onClick={()=>setSendToken(t)}>
                    {t==="USDC"?"💵":"💶"} {t}
                  </button>
                ))}
              </div>
              <label style={s.label}>Amount</label>
              <div style={s.amtWrap}>
                <input style={{...s.input,...s.amtInput}} placeholder="0.00" type="number" min="0" value={sendAmount} onChange={e=>setSendAmount(e.target.value)}/>
                <span style={s.amtToken}>{sendToken}</span>
              </div>
              {sendFeePreview && <>
                <div style={s.feeRow}><span>Fee (0.5%)</span><span>−{sendFeePreview} {sendToken}</span></div>
                <div style={{...s.feeRow,...s.feeRowNet}}><span>Recipient gets</span><span>{(parseFloat(sendAmount)-parseFloat(sendFeePreview)).toFixed(4)} {sendToken}</span></div>
              </>}
              <button style={{...s.btnPrimary,marginTop:16,opacity:sendStatus==="pending"?0.6:1}} onClick={sendTokens} disabled={sendStatus==="pending"}>
                {sendStatus==="pending"?"Sending…":sendStatus==="done"?"✓ Sent!":`Send ${sendToken}`}
              </button>
            </div>
          )}

          {tab==="swap" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Swap tokens</h3>
              <p style={s.panelSub}>1:1 rate · 0.2% fee</p>
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
              {swapFeePreview && <div style={s.feeRow}><span>Fee (0.2%)</span><span>−{swapFeePreview} {swapFrom}</span></div>}
              <button style={{...s.btnPrimary,marginTop:16,opacity:swapStatus==="pending"?0.6:1}} onClick={swapTokens} disabled={swapStatus==="pending"}>
                {swapStatus==="pending"?"Swapping…":swapStatus==="done"?"✓ Done!":`Swap ${swapFrom} → ${swapTo}`}
              </button>
              <div style={s.swapNote}>💡 Don't have EURC? Swap USDC → EURC here, then send to any .noma tag.</div>
            </div>
          )}

          {tab==="profile" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Your profile</h3>
              <div style={s.profileCard}>
                <div style={s.avatar}>{username.slice(0,2).toUpperCase()}</div>
                <div style={s.profileName}>{username}.noma</div>
                <div style={s.profileAddr}>{account}</div>
              </div>
              {[["Network","Arc Testnet"],["Noma Tag",`${username}.noma`],["Address",short(account)],["USDC Balance",`${usdcBal} USDC`],["EURC Balance",`${eurcBal} EURC`]].map(([k,v])=>(
                <div key={k} style={s.infoRow}><span style={s.infoKey}>{k}</span><span>{v}</span></div>
              ))}
              <div style={s.contractBox}>
                <div style={s.contractLabel}>Contract Address</div>
                <div style={s.contractAddr}>{NOMAPAY_CONTRACT}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer style={s.footer}>NomaPay · Arc Testnet · v1.0</footer>
    </div>
  );
}
