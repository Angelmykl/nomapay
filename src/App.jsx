import { useState } from "react";

// ─── Arc Testnet Config ─────────────────────────────────────────────────────
const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

// ─── Contract Addresses ─────────────────────────────────────────────────────
const NOMAPAY_CONTRACT = "0x7f88a72232860A77845Fa643B2941d1acC582bB7";
const USDC_ADDRESS     = "0x3600000000000000000000000000000000000000";
const EURC_ADDRESS     = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

// ─── Helpers ────────────────────────────────────────────────────────────────
const short = (addr) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : "";

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

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Balances ─────────────────────────────────────────────────────────
  const fetchBalances = async (address) => {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
      const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, provider);
      const eurc = new ethers.Contract(EURC_ADDRESS, erc20Abi, provider);
      const [uBal, eBal] = await Promise.all([
        usdc.balanceOf(address),
        eurc.balanceOf(address),
      ]);
      setUsdcBal((Number(uBal) / 1e6).toFixed(2));
      setEurcBal((Number(eBal) / 1e6).toFixed(2));
    } catch (err) {
      console.error("Balance fetch failed:", err);
    }
  };

  // ── Connect Wallet ─────────────────────────────────────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) {
      showToast("Please install MetaMask", "error");
      return;
    }
    try {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET.chainId }],
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ARC_TESTNET],
          });
        }
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      fetchBalances(accounts[0]);
      setStep("register");
      showToast("Wallet connected!");
    } catch (err) {
      showToast("Connection failed: " + err.message, "error");
    }
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
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function getUsername(address) view returns (string)"], provider);
  const existing = await contract.getUsername(account);
  if (existing && existing.length > 0) {
    localStorage.setItem(`nomapay_user_${account}`, existing);
    setUsername(existing);
    setStep("app");
    showToast(`Welcome back @${existing}!`);
    setRegLoading(false);
    return;
  }
} catch(e) {}
    setRegStatus({ type: "loading", msg: "Awaiting approval…" });
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, ["function approve(address,uint256) returns(bool)"], signer);
      await (await usdc.approve(NOMAPAY_CONTRACT, ethers.parseUnits("0.5", 6))).wait();
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function registerUsername(string)"], signer);
      await (await contract.registerUsername(regInput)).wait();

      localStorage.setItem(`nomapay_user_${account}`, regInput);
      setUsername(regInput);
      setStep("app");
      showToast(`@${regInput} registered! 🎉`);
    } catch (err) {
      setRegStatus({ type: "error", msg: err.message });
    }
    setRegLoading(false);
  };

  // ── Send Tokens ────────────────────────────────────────────────────────────
  const sendTokens = async () => {
    if (!sendTo || !sendAmount || parseFloat(sendAmount) <= 0) {
      showToast("Enter a recipient and amount", "error");
      return;
    }
    setSendStatus("pending");
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenAddr = sendToken === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amount = ethers.parseUnits(sendAmount, 6);
      const token = new ethers.Contract(tokenAddr, ["function approve(address,uint256) returns(bool)"], signer);
      await (await token.approve(NOMAPAY_CONTRACT, amount)).wait();
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function sendToUsername(string,address,uint256)"], signer);
      await (await contract.sendToUsername(sendTo, tokenAddr, amount)).wait();

      const fee = (parseFloat(sendAmount) * 0.005).toFixed(4);
      const net = (parseFloat(sendAmount) - parseFloat(fee)).toFixed(4);
      showToast(`Sent ${net} ${sendToken} to @${sendTo}!`);
      setSendAmount(""); setSendTo("");
      setSendStatus("done");
      fetchBalances(account);
      setTimeout(() => setSendStatus(null), 2000);
    } catch (err) {
      showToast("Send failed: " + err.message, "error");
      setSendStatus(null);
    }
  };

  // ── Swap Tokens ────────────────────────────────────────────────────────────
  const swapTokens = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      showToast("Enter an amount to swap", "error");
      return;
    }
    setSwapStatus("pending");
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const fromAddr = swapFrom === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const amount = ethers.parseUnits(swapAmount, 6);
      const token = new ethers.Contract(fromAddr, ["function approve(address,uint256) returns(bool)"], signer);
      await (await token.approve(NOMAPAY_CONTRACT, amount)).wait();
      const contract = new ethers.Contract(NOMAPAY_CONTRACT, ["function swap(address,uint256)"], signer);
      await (await contract.swap(fromAddr, amount)).wait();

      const toToken = swapFrom === "USDC" ? "EURC" : "USDC";
      const net = (parseFloat(swapAmount) * 0.998).toFixed(4);
      showToast(`Swapped ${swapAmount} ${swapFrom} → ${net} ${toToken}`);
      setSwapAmount("");
      setSwapStatus("done");
      fetchBalances(account);
      setTimeout(() => setSwapStatus(null), 2000);
    } catch (err) {
      showToast("Swap failed: " + err.message, "error");
      setSwapStatus(null);
    }
  };

  const swapTo         = swapFrom === "USDC" ? "EURC" : "USDC";
  const sendFeePreview = sendAmount ? (parseFloat(sendAmount) * 0.005).toFixed(4) : null;
  const swapNetPreview = swapAmount ? (parseFloat(swapAmount) * 0.998).toFixed(4) : null;
  const swapFeePreview = swapAmount ? (parseFloat(swapAmount) * 0.002).toFixed(4) : null;

  // ─── Styles ────────────────────────────────────────────────────────────────
  const C = {
    bg: "#080a0f", card: "#0f1117", border: "#1c2133",
    accent: "#00e5a0", accent2: "#0099ff",
    text: "#e8eaf2", muted: "#5a6478", error: "#ff5f5f", yellow: "#ffc947",
  };

  const s = {
    root: { minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Mono','Fira Code','Courier New',monospace", position:"relative", overflowX:"hidden" },
    bgGlow: { position:"fixed", inset:0, background:`radial-gradient(ellipse 70% 40% at 15% 10%, rgba(0,229,160,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(0,153,255,0.06) 0%, transparent 55%)`, pointerEvents:"none", zIndex:0 },
    bgGrid: { position:"fixed", inset:0, backgroundImage:`linear-gradient(${C.border} 1px, transparent 1px),linear-gradient(90deg,${C.border} 1px, transparent 1px)`, backgroundSize:"44px 44px", opacity:0.25, pointerEvents:"none", zIndex:0 },
    header: { position:"relative", zIndex:10, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 28px", borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(14px)", background:"rgba(8,10,15,0.85)" },
    logo: { display:"flex", alignItems:"center", gap:10 },
    logoMark: { fontSize:22, color:C.accent },
    logoText: { fontSize:19, fontWeight:700, letterSpacing:"0.04em" },
    logoSub: { fontSize:10, background:"rgba(0,229,160,0.12)", color:C.accent, padding:"2px 8px", borderRadius:4, letterSpacing:"0.08em", textTransform:"uppercase" },
    pill: { display:"flex", alignItems:"center", gap:7, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"5px 13px", fontSize:12, color:C.muted },
    dot: { width:7, height:7, borderRadius:"50%", background:C.accent, boxShadow:`0 0 6px ${C.accent}` },
    center: { position:"relative", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 64px)", padding:24 },
    card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:"40px 34px", maxWidth:420, width:"100%", boxShadow:"0 0 80px rgba(0,229,160,0.03)" },
    logoIcon: { fontSize:44, color:C.accent, textAlign:"center", marginBottom:12 },
    title: { fontSize:34, fontWeight:800, textAlign:"center", letterSpacing:"-0.02em", margin:"0 0 10px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
    sub: { textAlign:"center", color:C.muted, lineHeight:1.75, marginBottom:28, fontSize:14 },
    features: { marginBottom:28 },
    feat: { padding:"9px 0", borderBottom:`1px solid ${C.border}`, fontSize:13, color:C.muted, display:"flex", alignItems:"center", gap:10 },
    featIcon: { color:C.accent },
    btnPrimary: { width:"100%", padding:"14px 24px", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, color:"#080a0f", border:"none", borderRadius:11, fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.02em" },
    stepBadge: { display:"inline-block", fontSize:11, color:C.accent, background:"rgba(0,229,160,0.1)", padding:"3px 10px", borderRadius:4, marginBottom:14, letterSpacing:"0.08em" },
    cardTitle: { fontSize:21, fontWeight:700, margin:"0 0 8px" },
    cardSub: { color:C.muted, fontSize:13, lineHeight:1.65, marginBottom:22 },
    inputWrap: { display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:14, overflow:"hidden" },
    atSign: { padding:"0 14px", color:C.accent, fontSize:17, fontWeight:700, borderRight:`1px solid ${C.border}`, height:48, display:"flex", alignItems:"center" },
    input: { flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:15, padding:"0 16px", height:48, fontFamily:"inherit" },
    feeBox: { display:"flex", justifyContent:"space-between", background:"rgba(0,229,160,0.04)", border:`1px solid rgba(0,229,160,0.14)`, borderRadius:8, padding:"10px 14px", marginBottom:18, fontSize:13 },
    feeAmt: { color:C.accent, fontWeight:600 },
    statusMsg: { fontSize:13, marginBottom:14, lineHeight:1.5 },
    hint: { textAlign:"center", color:C.muted, fontSize:11, marginTop:10 },
    appWrap: { position:"relative", zIndex:10, maxWidth:500, margin:"0 auto", padding:"22px 18px 60px" },
    userBar: { display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:14 },
    userHandle: { fontSize:17, fontWeight:700, color:C.accent },
    userAddr: { fontSize:11, color:C.muted, marginTop:2 },
    tabs: { display:"flex", gap:3, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:3, marginBottom:14 },
    tabBtn: { flex:1, padding:"10px 6px", background:"transparent", border:"none", color:C.muted, cursor:"pointer", borderRadius:8, fontSize:13, fontFamily:"inherit" },
    tabActive: { background:"rgba(0,229,160,0.1)", color:C.accent, fontWeight:600 },
    panel: { background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 18px" },
    panelTitle: { fontSize:17, fontWeight:700, margin:"0 0 4px" },
    panelSub: { color:C.muted, fontSize:12, marginBottom:18 },
    label: { display:"block", fontSize:10, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.1em" },
    tokenToggle: { display:"flex", gap:8, marginBottom:14 },
    tokenBtn: { flex:1, padding:"11px 8px", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontSize:14, fontFamily:"inherit" },
    tokenBtnActive: { border:`1px solid ${C.accent}`, color:C.accent, background:"rgba(0,229,160,0.07)" },
    amtWrap: { display:"flex", alignItems:"center", background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, marginBottom:8, overflow:"hidden" },
    amtInput: { fontSize:22, fontWeight:700, height:54 },
    amtToken: { padding:"0 15px", color:C.muted, fontSize:13, borderLeft:`1px solid ${C.border}`, height:54, display:"flex", alignItems:"center" },
    feeRow: { display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, padding:"4px 0" },
    feeRowNet: { color:C.accent, fontWeight:600 },
    swapBox: { display:"flex", alignItems:"center", gap:8, marginBottom:10 },
    swapSide: { flex:1, background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" },
    swapLabel: { fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 },
    swapToken: { fontSize:13, fontWeight:600, marginBottom:7 },
    swapInput: { height:38, fontSize:18, fontWeight:700, padding:0 },
    swapOutput: { fontSize:18, fontWeight:700, color:C.accent, height:38, display:"flex", alignItems:"center" },
    swapArrow: { width:38, height:38, borderRadius:"50%", background:"rgba(0,229,160,0.1)", border:`1px solid ${C.accent}`, color:C.accent, cursor:"pointer", fontSize:15, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
    swapNote: { marginTop:14, padding:"10px 13px", background:"rgba(255,201,71,0.05)", border:`1px solid rgba(255,201,71,0.18)`, borderRadius:8, fontSize:12, color:"rgba(255,201,71,0.7)", lineHeight:1.55 },
    profileCard: { textAlign:"center", padding:"20px 0 18px", borderBottom:`1px solid ${C.border}`, marginBottom:18 },
    avatar: { width:60, height:60, borderRadius:"50%", background:`linear-gradient(130deg,${C.accent},${C.accent2})`, color:"#080a0f", fontWeight:800, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" },
    profileName: { fontSize:19, fontWeight:700, color:C.accent },
    profileAddr: { fontSize:11, color:C.muted, marginTop:3, wordBreak:"break-all" },
    infoRow: { display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 },
    infoKey: { color:C.muted },
    contractBox: { background:"#0b0d12", border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 13px", marginTop:16 },
    contractLabel: { fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 },
    contractAddr: { fontSize:11, color:C.muted, wordBreak:"break-all" },
    toast: { position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"rgba(0,229,160,0.12)", border:`1px solid ${C.accent}`, color:C.accent, padding:"11px 22px", borderRadius:40, fontSize:13, fontWeight:600, zIndex:100, backdropFilter:"blur(12px)", whiteSpace:"nowrap" },
    toastErr: { background:"rgba(255,95,95,0.12)", border:`1px solid ${C.error}`, color:C.error },
    footer: { position:"relative", zIndex:10, textAlign:"center", padding:"22px", color:C.muted, fontSize:11, letterSpacing:"0.07em", borderTop:`1px solid ${C.border}` },
    disconnectBtn: { background:"rgba(255,95,95,0.1)", border:"1px solid rgba(255,95,95,0.3)", color:"#ff5f5f", borderRadius:20, padding:"5px 13px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
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
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={s.pill}><span style={s.dot}/>{short(account)}</div>
            <button
              style={s.disconnectBtn}
              onClick={async () => {
                setAccount(null); setUsername(""); setStep("connect");
                if (window.ethereum) {
                  await window.ethereum.request({
                    method: "wallet_revokePermissions",
                    params: [{ eth_accounts: {} }]
                  });
                }
              }}
            >Disconnect</button>
          </div>
        )}
      </header>

      {/* ── CONNECT ── */}
      {step==="connect" && (
        <div style={s.center}>
          <div style={s.card}>
            <div style={s.logoIcon}>◈</div>
            <h1 style={s.title}>NomaPay</h1>
<p style={{...s.sub, fontSize:13, color:C.accent, letterSpacing:"0.06em", marginBottom:8}}>WELCOME TO NOMAPAY</p>
<p style={s.sub}>A cross-border payment platform built on Arc Testnet. Send USDC & EURC globally using just a @nomatag — no addresses, no friction, just payments.</p>
<div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:24}}>
  {["⚡ Instant","🌍 Cross-border","🔒 On-chain","💵 USDC & EURC"].map(tag => (
    <span key={tag} style={{fontSize:11, background:"rgba(0,229,160,0.08)", border:"1px solid rgba(0,229,160,0.2)", color:C.accent, padding:"4px 10px", borderRadius:20}}>{tag}</span>
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

      {/* ── REGISTER ── */}
      {step==="register" && (
        <div style={s.center}>
          <div style={s.card}>
            <div style={s.stepBadge}>NEW ACCOUNT</div>
            <h2 style={s.cardTitle}>Pick your nomatag</h2>
            <p style={s.cardSub}>This is permanent and tied to your wallet. People send you money using this tag.</p>
            <div style={s.inputWrap}>
              <span style={s.atSign}>@</span>
              <input style={s.input} placeholder="yournomatag" value={regInput}
                onChange={e=>{setRegInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""));setRegStatus(null);}}
                onKeyDown={e=>e.key==="Enter"&&registerUsername()} maxLength={20}/>
            </div>
            <div style={s.feeBox}><span>Registration fee</span><span style={s.feeAmt}>0.50 USDC</span></div>
            {regStatus && <div style={{...s.statusMsg,color:regStatus.type==="error"?C.error:"#80d0a0"}}>{regStatus.msg}</div>}
            <button style={{...s.btnPrimary,opacity:regLoading?0.6:1}} onClick={registerUsername} disabled={regLoading}>
              {regLoading?"Processing…":"Create Nomatag →"}
            </button>
            <p style={s.hint}>Lowercase · numbers · underscore · 3–20 chars</p>
          </div>
        </div>
      )}

      {/* ── APP ── */}
      {step==="app" && (
        <div style={s.appWrap}>
          <div style={s.userBar}>
            <div>
              <div style={s.userHandle}>@{username}</div>
              <div style={s.userAddr}>{short(account)}</div>
            </div>
            <div style={{display:"flex", gap:6}}>
              {[["USDC", usdcBal],["EURC", eurcBal]].map(([t, bal])=>(
                <div key={t} style={{background:"#0b0d12",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",textAlign:"right"}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{bal}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.tabs}>
            {[["send","↗ Send"],["swap","⇄ Swap"],["profile","◉ Profile"]].map(([id,label])=>(
              <button key={id} style={{...s.tabBtn,...(tab===id?s.tabActive:{})}} onClick={()=>setTab(id)}>{label}</button>
            ))}
          </div>

          {/* SEND */}
          {tab==="send" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Send to NomaPay user</h3>
              <p style={s.panelSub}>Send to any NomaPay user instantly</p>
              <label style={s.label}>Recipient</label>
              <div style={s.inputWrap}>
                <span style={s.atSign}>@</span>
                <input style={s.input} placeholder="nomatag" value={sendTo}
                  onChange={e=>setSendTo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/>
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
                <input style={{...s.input,...s.amtInput}} placeholder="0.00" type="number" min="0"
                  value={sendAmount} onChange={e=>setSendAmount(e.target.value)}/>
                <span style={s.amtToken}>{sendToken}</span>
              </div>
              {sendFeePreview && <>
                <div style={s.feeRow}><span>Fee (0.5%)</span><span>−{sendFeePreview} {sendToken}</span></div>
                <div style={{...s.feeRow,...s.feeRowNet}}><span>Recipient gets</span><span>{(parseFloat(sendAmount)-parseFloat(sendFeePreview)).toFixed(4)} {sendToken}</span></div>
              </>}
              <button style={{...s.btnPrimary,marginTop:20,opacity:sendStatus==="pending"?0.6:1}}
                onClick={sendTokens} disabled={sendStatus==="pending"}>
                {sendStatus==="pending"?"Sending…":sendStatus==="done"?"✓ Sent!":`Send ${sendToken}`}
              </button>
            </div>
          )}

          {/* SWAP */}
          {tab==="swap" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Swap tokens</h3>
              <p style={s.panelSub}>1:1 rate · 0.2% fee</p>
              <div style={s.swapBox}>
                <div style={s.swapSide}>
                  <div style={s.swapLabel}>You pay</div>
                  <div style={s.swapToken}>{swapFrom==="USDC"?"💵":"💶"} {swapFrom}</div>
                  <input style={{...s.input,...s.swapInput}} placeholder="0.00" type="number" min="0"
                    value={swapAmount} onChange={e=>setSwapAmount(e.target.value)}/>
                </div>
                <button style={s.swapArrow} onClick={()=>setSwapFrom(f=>f==="USDC"?"EURC":"USDC")}>⇄</button>
                <div style={s.swapSide}>
                  <div style={s.swapLabel}>You receive</div>
                  <div style={s.swapToken}>{swapTo==="USDC"?"💵":"💶"} {swapTo}</div>
                  <div style={s.swapOutput}>{swapNetPreview||"0.00"}</div>
                </div>
              </div>
              {swapFeePreview && <div style={s.feeRow}><span>Fee (0.2%)</span><span>−{swapFeePreview} {swapFrom}</span></div>}
              <button style={{...s.btnPrimary,marginTop:20,opacity:swapStatus==="pending"?0.6:1}}
                onClick={swapTokens} disabled={swapStatus==="pending"}>
                {swapStatus==="pending"?"Swapping…":swapStatus==="done"?"✓ Done!":`Swap ${swapFrom} → ${swapTo}`}
              </button>
              <div style={s.swapNote}>💡 Don't have EURC? Swap USDC → EURC here, then send it to any nomatag.</div>
            </div>
          )}

          {/* PROFILE */}
          {tab==="profile" && (
            <div style={s.panel}>
              <h3 style={s.panelTitle}>Your profile</h3>
              <div style={s.profileCard}>
                <div style={s.avatar}>{username.slice(0,2).toUpperCase()}</div>
                <div style={s.profileName}>@{username}</div>
                <div style={s.profileAddr}>{account}</div>
              </div>
              {[
                ["Network","Arc Testnet"],
                ["Nomatag",`@${username}`],
                ["Address",short(account)],
                ["USDC Balance",`${usdcBal} USDC`],
                ["EURC Balance",`${eurcBal} EURC`],
              ].map(([k,v])=>(
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
