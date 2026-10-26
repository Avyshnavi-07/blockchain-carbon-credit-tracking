import { BrowserProvider, Contract, isAddress } from "ethers";
import abi from "./abi.json";
import "./style.css";

const KEY = "carbon-ledger-config-v1";
const defaults = { address: "", chainId: "31337" };
let config = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
let provider, signer, contract, account, admin;

const app = document.querySelector("#app");
app.innerHTML = `
  <header class="topbar"><a class="brand" href="#"><span class="brand-mark">C</span><span>carbon<span class="brand-light">ledger</span><small>ON-CHAIN CREDIT REGISTRY</small></span></a><div class="top-actions"><span id="network-pill" class="network-pill">Wallet disconnected</span><button id="connect" class="button button-light">Connect wallet</button></div></header>
  <main>
    <section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> TRANSPARENT BY DESIGN</div><h1>Every credit has<br/>a <em>clear history.</em></h1><p>Register, transfer, verify, and retire carbon credit records with a traceable on-chain history.</p><div class="hero-note"><span>↗</span> A prototype registry. Project claims still require independent verification.</div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="leaf">↗</div><div class="art-label">TRACKED ON CHAIN<br/><strong>ISSUE · TRANSFER · RETIRE</strong></div></div></section>
    <section class="dashboard-head"><div><div class="eyebrow">REGISTRY OVERVIEW</div><h2>Credit records</h2><p class="muted">Browse the on-chain record and current status of each credit batch.</p></div><div class="stats"><div class="stat"><span>Total records</span><strong id="stat-total">—</strong></div><div class="stat"><span>Active records</span><strong id="stat-active">—</strong></div><div class="stat"><span>Retired records</span><strong id="stat-retired">—</strong></div></div></section>
    <section id="notice" class="notice hidden" role="status"></section>
    <section id="records" class="records"><div class="empty"><div class="empty-icon">⌁</div><strong>Connect your wallet to open the registry</strong><span>Connect MetaMask and choose the network where your contract is deployed.</span></div></section>
    <section class="workspace"><div class="section-heading"><div><div class="eyebrow">ACTIONS</div><h2>Manage credits</h2></div><span class="muted small">Transaction requests are signed by your connected wallet.</span></div><div class="action-grid">
      <form id="issue-form" class="action-card"><div class="card-index">01 / ISSUER</div><h3>Register a credit</h3><p>Only an authorized issuer can create a new credit record.</p><label>Project name<input name="project" required maxlength="120" placeholder="e.g. Krishna River restoration" /></label><label>Initial owner address<input name="owner" required placeholder="0x…" /></label><div class="two-fields"><label>Quantity (credits)<input name="quantity" required type="number" min="1" step="1" placeholder="100" /></label><label>Document CID or hash <span class="optional">optional</span><input name="document" placeholder="ipfs://… or SHA-256" /></label></div><button class="button button-dark" type="submit">Register on chain <span>↗</span></button></form>
      <form id="transfer-form" class="action-card"><div class="card-index">02 / OWNER</div><h3>Transfer a record</h3><p>Transfers the complete credit batch to its new owner.</p><label>Credit ID<input name="id" type="number" required min="1" placeholder="e.g. 1" /></label><label>Recipient wallet address<input name="recipient" required placeholder="0x…" /></label><button class="button button-outline" type="submit">Transfer record <span>↗</span></button></form>
      <form id="retire-form" class="action-card"><div class="card-index">03 / OWNER</div><h3>Retire a record</h3><p>Retirement is permanent and prevents further transfers.</p><label>Credit ID<input name="id" type="number" required min="1" placeholder="e.g. 1" /></label><label>Retirement purpose<input name="purpose" required maxlength="240" placeholder="e.g. 2026 operational emissions" /></label><button class="button button-outline" type="submit">Retire permanently <span>↗</span></button></form>
      <form id="verify-form" class="action-card verify-card"><div class="card-index">04 / PUBLIC LOOKUP</div><h3>Verify a record</h3><p>Check the current owner, retirement status, and recorded owner history.</p><label>Credit ID<input name="id" type="number" required min="1" placeholder="e.g. 1" /></label><button class="button button-outline" type="submit">Look up record <span>↗</span></button><div id="verify-result" class="verify-result hidden"></div></form>
      <form id="issuer-form" class="action-card"><div class="card-index">05 / ADMIN</div><h3>Manage issuers</h3><p>Authorize or remove a wallet address from the issuer allowlist.</p><label>Issuer wallet address<input name="issuer" required placeholder="0x…" /></label><label>Action<select name="authorized"><option value="true">Authorize issuer</option><option value="false">Remove issuer</option></select></label><button class="button button-outline" type="submit">Update issuer access <span>↗</span></button></form>
    </div></section>
    <details class="settings"><summary>Contract connection settings</summary><form id="config-form"><label>Deployed contract address<input name="address" value="${escapeAttr(config.address)}" placeholder="0x…" /></label><label>Expected chain ID<input name="chainId" value="${escapeAttr(config.chainId)}" placeholder="31337" /></label><button class="button button-light" type="submit">Save connection</button><span class="muted small">For local Hardhat, add the network in MetaMask: RPC http://127.0.0.1:8545, chain ID 31337. For another network, use its chain ID and deployed contract address.</span></form></details>
    <footer><span>CARBON LEDGER · EDUCATIONAL PROTOTYPE</span><span>On-chain records cannot validate the underlying environmental claims.</span></footer>
  </main>`;

const $ = (q) => document.querySelector(q);
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function escapeAttr(v) { return escapeHtml(v); }
function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function date(ts) { return ts && Number(ts) ? new Date(Number(ts) * 1000).toLocaleDateString() : "—"; }
function setNotice(message, kind = "info") { const n=$("#notice"); n.textContent=message; n.className=`notice ${kind}`; n.scrollIntoView({behavior:"smooth",block:"nearest"}); }
function explain(err) { return err?.shortMessage || err?.reason || err?.info?.error?.message || err?.message?.replace(/^Error:\s*/, "") || "Something went wrong."; }
async function connect() {
  if (!window.ethereum) throw new Error("MetaMask was not found. Install MetaMask, then reload this page.");
  provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner(); account = await signer.getAddress();
  const net = await provider.getNetwork();
  if (String(net.chainId) !== String(config.chainId)) throw new Error(`Wrong network. MetaMask is on chain ${net.chainId}; expected ${config.chainId}. Change networks, then connect again.`);
  if (!isAddress(config.address)) throw new Error("Save the deployed contract address in Contract connection settings first.");
  contract = new Contract(config.address, abi, signer);
  admin = await contract.admin();
  $("#connect").textContent = short(account);
  $("#network-pill").textContent = `CHAIN ${net.chainId} · ${short(account)}`;
  setNotice("Wallet connected. Registry data loaded from the selected chain.", "success");
  await refresh();
}
async function refresh() {
  if (!contract) return;
  const count = Number(await contract.nextCreditId()) - 1;
  const credits = [];
  // The demo has a small on-chain registry. Larger deployments should use an indexer.
  for (let id=1; id<=count; id++) credits.push(await contract.getCredit(id));
  const active=credits.filter(c=>!c.retired).length, retired=credits.length-active;
  $("#stat-total").textContent=credits.length; $("#stat-active").textContent=active; $("#stat-retired").textContent=retired;
  const records=$("#records");
  if (!credits.length) { records.innerHTML=`<div class="empty"><div class="empty-icon">⌁</div><strong>No credit records yet</strong><span>Authorized issuers can create the first record using the form below.</span></div>`; return; }
  records.innerHTML=credits.slice().reverse().map(c=>`<article class="record ${c.retired?"is-retired":""}"><div class="record-top"><span class="record-id">CREDIT #${c.id}</span><span class="status ${c.retired?"retired":"active"}"><i></i>${c.retired?"RETIRED":"ACTIVE"}</span></div><h3>${escapeHtml(c.projectName)}</h3><div class="record-quantity">${c.quantity.toString()} <span>credits</span></div><div class="record-details"><div><span>Current owner</span><strong title="${c.owner}">${short(c.owner)}</strong></div><div><span>Issued by</span><strong title="${c.issuer}">${short(c.issuer)}</strong></div><div><span>Registered</span><strong>${date(c.registeredAt)}</strong></div>${c.retired?`<div><span>Retirement purpose</span><strong>${escapeHtml(c.retirementPurpose)}</strong></div>`:""}</div>${c.documentHash?`<div class="document-ref">DOCUMENT REF <span>${escapeHtml(c.documentHash)}</span></div>`:""}<button class="text-button history-button" data-id="${c.id}">View ownership history ↗</button></article>`).join("");
  records.querySelectorAll(".history-button").forEach(b=>b.addEventListener("click",()=>showHistory(b.dataset.id)));
}
async function showHistory(id) {
  try { const c=await contract.getCredit(id), history=await contract.getOwnershipHistory(id); const mine=await contract.verifyOwnership(id,account); setNotice(`Credit #${id} · current owner ${c.owner} · ${c.retired?"RETIRED":"ACTIVE"} · ${mine?"This wallet is the current owner.":"This wallet is not the current owner."} · History: ${history.map((a,i)=>`${i+1}. ${a}`).join(" → ")}`, "info"); }
  catch(e){setNotice(explain(e),"error");}
}
async function transact(action) { try { setNotice("Confirm the transaction in your wallet…", "info"); const tx=await action(); setNotice(`Transaction submitted: ${tx.hash}. Waiting for confirmation…`, "info"); await tx.wait(); setNotice("Transaction confirmed. Registry refreshed.", "success"); await refresh(); } catch(e) { setNotice(explain(e),"error"); } }

$("#connect").addEventListener("click", async()=>{try{await connect()}catch(e){setNotice(explain(e),"error");}});
$("#config-form").addEventListener("submit",e=>{e.preventDefault();const d=new FormData(e.currentTarget);config={address:d.get("address").trim(),chainId:d.get("chainId").trim()};localStorage.setItem(KEY,JSON.stringify(config));setNotice("Connection settings saved. Connect or reconnect your wallet to load the registry.","success");});
$("#issue-form").addEventListener("submit",async e=>{e.preventDefault();if(!contract)return setNotice("Connect your wallet first.","error");if(!(await contract.authorizedIssuers(account)))return setNotice("This wallet is not an authorized issuer. Ask the administrator to add it.","error");const d=new FormData(e.currentTarget), owner=d.get("owner").trim();if(!isAddress(owner))return setNotice("Enter a valid owner wallet address.","error");await transact(()=>contract.registerCredit(d.get("project").trim(),owner,BigInt(d.get("quantity")),d.get("document").trim()));e.currentTarget.reset();});
$("#transfer-form").addEventListener("submit",async e=>{e.preventDefault();if(!contract)return setNotice("Connect your wallet first.","error");const d=new FormData(e.currentTarget), recipient=d.get("recipient").trim();if(!isAddress(recipient))return setNotice("Enter a valid recipient wallet address.","error");await transact(()=>contract.transferCredit(BigInt(d.get("id")),recipient));e.currentTarget.reset();});
$("#retire-form").addEventListener("submit",async e=>{e.preventDefault();if(!contract)return setNotice("Connect your wallet first.","error");const d=new FormData(e.currentTarget);await transact(()=>contract.retireCredit(BigInt(d.get("id")),d.get("purpose").trim()));e.currentTarget.reset();});
$("#verify-form").addEventListener("submit",async e=>{e.preventDefault();if(!contract)return setNotice("Connect your wallet first.","error");try{const id=BigInt(new FormData(e.currentTarget).get("id")),c=await contract.getCredit(id),history=await contract.getOwnershipHistory(id),mine=await contract.verifyOwnership(id,account);const box=$("#verify-result");box.classList.remove("hidden");box.innerHTML=`<strong>${c.retired?"RETIRED":"ACTIVE"} · ${c.quantity.toString()} credits</strong><span>Project: ${escapeHtml(c.projectName)}</span><span>Owner: ${escapeHtml(c.owner)}</span><span>Issuer: ${escapeHtml(c.issuer)}</span><span>Ownership changes: ${history.length}</span><span>${mine?"Your wallet is the current owner.":"Your wallet is not the current owner."}</span>`;}catch(err){setNotice(explain(err),"error");}});
if(window.ethereum) window.ethereum.on?.("chainChanged",()=>window.location.reload());

$("#issuer-form").addEventListener("submit",async e=>{e.preventDefault();if(!contract)return setNotice("Connect your wallet first.","error");if(account.toLowerCase()!==admin.toLowerCase())return setNotice("Only the contract administrator can manage issuers.","error");const d=new FormData(e.currentTarget), issuer=d.get("issuer").trim();if(!isAddress(issuer))return setNotice("Enter a valid issuer wallet address.","error");await transact(()=>contract.setIssuer(issuer,d.get("authorized")==="true"));e.currentTarget.reset();});
