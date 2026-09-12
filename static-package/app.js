const elements = {
  form: document.querySelector("#questionForm"),
  input: document.querySelector("#questionInput"),
  charCount: document.querySelector("#charCount"),
  hero: document.querySelector("#heroSection"),
  progress: document.querySelector("#progressSection"),
  progressTitle: document.querySelector("#progressTitle"),
  progressDetail: document.querySelector("#progressDetail"),
  progressSteps: [...document.querySelectorAll("#progressSteps li")],
  results: document.querySelector("#resultSection"),
  resultQuestion: document.querySelector("#resultQuestion"),
  resultMode: document.querySelector("#resultMode"),
  modeBadge: document.querySelector("#modeBadge"),
  coreTension: document.querySelector("#coreTension"),
  queryPills: document.querySelector("#queryPills"),
  warningBox: document.querySelector("#warningBox"),
  mapTitle: document.querySelector("#mapTitle"),
  islandMap: document.querySelector("#islandMap"),
  restart: document.querySelector("#restartButton"),
  bottomRestart: document.querySelector("#bottomRestart"),
  dialog: document.querySelector("#personDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  personContent: document.querySelector("#personContent"),
  toast: document.querySelector("#toast")
};

const progressCopy = [
  ["正在理解你的问题", "保留原问题，拆解不同的搜索方向。"],
  ["正在沿知乎内容寻找线索", "同时搜索经验、能力、风险和行动路径。"],
  ["正在整理不同观点", "把相似内容归到同一座观点岛，并保留证据。"],
  ["正在寻找值得认识的人", "从内容出发，解释为什么值得继续交流。"]
];

const state = {
  result: null,
  selectedClusterIndex: -1,
  transitioning: false,
  progressTimer: null
};

const islandDefinitions = [
  ["机会远望岛", "远望", "#4f5e3c", "关注选择可能带来的新增价值、成长空间和趋势机会。", "知友·实践派", "演示画像｜关注真实经验", "更关心选择能否在真实场景里创造新增价值。", "先找到一个足够小的真实问题，用结果检验自己是否真的喜欢这条路。"],
  ["能力底牌岛", "底牌", "#6f7652", "讨论做成这件事需要的能力、门槛和适用条件。", "知友·能力派", "演示画像｜关注能力结构", "认为兴趣只是起点，长期适配还取决于能力组合和工作方式。", "不要只比较岗位名称，要比较每天实际需要完成的工作。"],
  ["风险校准岛", "风险", "#9b6b35", "提醒识别动机、转换成本、失败可能和被忽略的代价。", "知友·校准派", "演示画像｜关注决策代价", "提醒先识别真实动机，再评估转换成本和不可逆部分。", "厌倦现在的状态，并不自动等于适合另一个方向。"],
  ["行动启程岛", "启程", "#52686a", "提供试验、过渡、学习和下一步行动的具体路线。", "知友·路径派", "演示画像｜关注低成本验证", "主张先用项目、访谈和短期实践验证，再决定是否完全切换。", "先做一次两周实验，比继续想象新方向更容易得到答案。"]
];

function buildStaticResult(question) {
  const evidence = islandDefinitions.map((item, index) => ({
    id: `static-${index}`, title: `演示内容：从${item[1]}角度看“${question}”`,
    excerpt: item[7], url: `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(question)}`,
    isSynthetic: true
  }));
  return {
    question,
    analysis: { coreTension: "围绕机会、能力、风险和行动路径，找到更适合自己的判断。", searchQueries: [question, `${question} 真实经验`, `${question} 风险成本`, `${question} 如何开始`] },
    clusters: islandDefinitions.map((item, index) => ({
      id: `island-${index}`, name: item[0], shortName: item[1], color: item[2], summary: item[3], contentCount: 1, evidenceIds: [evidence[index].id],
      people: [{ id: `person-${index}`, name: item[4], headline: item[5], recommendationType: index === 2 ? "值得追问" : "观点互补", viewpoint: item[6], connectionReason: `你正在思考“${question}”。TA 能从${item[1]}角度补充你的判断。`, quote: { text: item[7], evidenceId: evidence[index].id } }]
    })),
    evidence, status: "succeeded", mode: "demo", warnings: [{ message: "这是可离线打开的静态演示版，人物与内容为演示画像，不代表真实知乎用户。" }]
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : "#2468f2";
}

function safeZhihuUrl(value) {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "zhihu.com" || url.hostname.endsWith(".zhihu.com");
    return url.protocol === "https:" && validHost ? url.href : "https://www.zhihu.com/";
  } catch {
    return "https://www.zhihu.com/";
  }
}

function safeAvatarUrl(value) {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "zhimg.com" || url.hostname.endsWith(".zhimg.com");
    return url.protocol === "https:" && validHost ? url.href : "";
  } catch {
    return "";
  }
}

function initials(name) {
  const clean = String(name || "知").replace(/知友[·・]?/g, "").trim();
  return escapeHtml(clean.slice(0, 1) || "知");
}

function avatarMarkup(person) {
  const avatarUrl = safeAvatarUrl(person?.avatar);
  return avatarUrl
    ? `<span class="avatar"><img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer"></span>`
    : `<span class="avatar">${initials(person?.name)}</span>`;
}

function setModeBadge(mode) {
  const isLive = mode === "live";
  elements.modeBadge.className = `mode-badge ${isLive ? "live" : "demo"}`;
  elements.modeBadge.textContent = isLive ? "真实知乎数据" : "安全演示模式";
}

async function checkHealth() {
  setModeBadge("demo");
}

function updateCharCount() {
  elements.charCount.textContent = `${elements.input.value.length} / 100`;
}

function startProgress() {
  let index = 0;
  updateProgress(index);
  state.progressTimer = window.setInterval(() => {
    index = Math.min(index + 1, progressCopy.length - 1);
    updateProgress(index);
  }, 700);
}

function updateProgress(index) {
  const [title, detail] = progressCopy[index];
  elements.progressTitle.textContent = title;
  elements.progressDetail.textContent = detail;
  elements.progressSteps.forEach((step, stepIndex) => {
    step.classList.toggle("active", stepIndex === index);
    step.classList.toggle("done", stepIndex < index);
  });
}

function stopProgress() {
  window.clearInterval(state.progressTimer);
  state.progressTimer = null;
  updateProgress(progressCopy.length - 1);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function submitQuestion(question) {
  const submitButton = elements.form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  elements.hero.hidden = true;
  elements.results.hidden = true;
  elements.progress.hidden = false;
  elements.restart.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  startProgress();

  try {
    await delay(1500);
    const payload = buildStaticResult(question);

    stopProgress();
    state.result = payload;
    state.selectedClusterIndex = -1;
    renderResult();
    saveRecentQuestion(question);
    await delay(250);
    elements.progress.hidden = true;
    elements.results.hidden = false;
    elements.restart.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    stopProgress();
    elements.progress.hidden = true;
    elements.hero.hidden = false;
    showToast(error.message || "探索失败，请稍后重试。");
  } finally {
    submitButton.disabled = false;
  }
}

function saveRecentQuestion(question) {
  try {
    const existing = JSON.parse(localStorage.getItem("zhilu-recent") || "[]");
    const next = [question, ...existing.filter((item) => item !== question)].slice(0, 5);
    localStorage.setItem("zhilu-recent", JSON.stringify(next));
  } catch {
    // 浏览器禁用本地存储时不影响主流程。
  }
}

function renderResult() {
  const result = state.result;
  elements.resultQuestion.textContent = result.question;
  elements.coreTension.textContent = result.analysis?.coreTension || "正在比较不同的思考路径";
  elements.queryPills.innerHTML = (result.analysis?.searchQueries || [])
    .map((query) => `<span>${escapeHtml(query)}</span>`)
    .join("");

  const isLive = result.mode === "live";
  elements.resultMode.className = `result-mode ${isLive ? "live" : "demo"}`;
  elements.resultMode.textContent = isLive
    ? "基于真实知乎搜索"
    : result.mode === "fallback"
      ? "真实接口不足 · 已安全降级"
      : "演示数据 · 完整流程";

  const warnings = (result.warnings || []).filter((warning) => warning?.message);
  elements.warningBox.hidden = warnings.length === 0;
  elements.warningBox.textContent = warnings.map((warning) => warning.message).join(" ");

  renderIslands();
}

function renderIslands() {
  elements.mapTitle.textContent = "四座岛，四种看待问题的方式";
  elements.islandMap.className = "island-map";
  elements.islandMap.innerHTML = `
    <div class="map-center-note" aria-hidden="true">
      <span>沿问题启航</span>
      <strong>四种方向<br>四群具体的人</strong>
    </div>
  `;
  state.result.clusters.forEach((cluster, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `island-button island-position-${index}`;
    button.style.setProperty("--island-color", safeColor(cluster.color));
    button.setAttribute("aria-label", `探索${cluster.name}，${cluster.people?.length || 0} 位代表知友`);
    button.innerHTML = `
      <span class="island-label">
        <span class="island-number">ISLAND ${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(cluster.name)}</strong>
        <span class="island-rule"></span>
        <small>${escapeHtml(cluster.summary)}</small>
        <span class="island-count">${Number(cluster.contentCount || cluster.evidenceIds?.length || 0)} 条线索 · ${cluster.people?.length || 0} 位知友</span>
      </span>
      <span class="island-marker" aria-hidden="true"></span>
    `;
    button.addEventListener("click", () => enterIsland(index));
    elements.islandMap.append(button);
  });
}

async function enterIsland(index) {
  if (state.transitioning) return;
  const cluster = state.result.clusters[index];
  if (!cluster) return;

  state.transitioning = true;
  state.selectedClusterIndex = index;
  elements.islandMap.classList.add("is-transitioning");
  elements.islandMap.insertAdjacentHTML("beforeend", `
    <div class="scene-transition" role="status">
      <span class="transition-compass" aria-hidden="true">✦</span>
      <small>沿观点航线前行</small>
      <strong>正在前往${escapeHtml(cluster.name)}</strong>
    </div>
  `);

  await delay(520);
  renderIslandScene(index);
  state.transitioning = false;
}

function renderIslandScene(index) {
  const cluster = state.result.clusters[index];
  const color = safeColor(cluster.color);
  const people = cluster.people || [];
  elements.mapTitle.textContent = `${cluster.name} · 点击头像认识岛上的人`;
  elements.islandMap.className = `island-map island-scene focus-${index}`;
  elements.islandMap.style.setProperty("--scene-color", color);
  elements.islandMap.innerHTML = `
    <button class="map-back-button" type="button" aria-label="返回四岛地图">
      <span aria-hidden="true">←</span> 返回群岛
    </button>
    <div class="island-scene-heading">
      <span>ISLAND ${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(cluster.name)}</h3>
      <i></i>
      <p>${escapeHtml(cluster.summary)}</p>
      <small>${people.length} 位知友 · 点击头像查看观点依据</small>
    </div>
    <div class="map-people-layer" aria-label="${escapeHtml(cluster.name)}上的代表知友"></div>
  `;

  elements.islandMap.querySelector(".map-back-button").addEventListener("click", leaveIsland);
  const layer = elements.islandMap.querySelector(".map-people-layer");

  if (!people.length) {
    layer.innerHTML = '<div class="map-empty-person">这座岛暂时没有足够可靠的人物线索。</div>';
    return;
  }

  people.slice(0, 3).forEach((person, personIndex) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `map-person-node person-node-${personIndex}`;
    node.style.setProperty("--person-color", color);
    node.setAttribute("aria-label", `查看${person.name}的观点`);
    node.innerHTML = `
      <span class="map-person-anchor">
        ${avatarMarkup(person)}
        <span class="map-person-name">
          <strong class="person-name">${escapeHtml(person.name)}</strong>
          <small>${escapeHtml(person.recommendationType || "值得了解")}</small>
          <span>${escapeHtml(person.viewpoint)}</span>
        </span>
      </span>
      <span class="map-person-thought">
        <em>${escapeHtml(person.headline || "相关内容作者")}</em>
        <strong>${escapeHtml(person.viewpoint)}</strong>
        <q>${escapeHtml(person.quote?.text || "从公开内容继续了解 TA 的判断")}</q>
        <small>点击查看原文证据与破冰话术 →</small>
      </span>
    `;
    node.addEventListener("click", () => openPerson(person, cluster, color));
    layer.append(node);
  });

  requestAnimationFrame(() => elements.islandMap.classList.add("scene-ready"));
}

function leaveIsland() {
  if (state.transitioning) return;
  state.selectedClusterIndex = -1;
  elements.islandMap.classList.add("scene-leaving");
  window.setTimeout(renderIslands, 260);
}

function findEvidence(id) {
  return state.result.evidence?.find((item) => item.id === id);
}

async function openPerson(person, cluster, color) {
  const evidence = findEvidence(person.quote?.evidenceId || person.evidenceIds?.[0]);
  const sourceUrl = safeZhihuUrl(evidence?.url);
  const sourceLabel = evidence?.isSynthetic ? "打开知乎搜索" : "查看知乎原文";

  elements.personContent.innerHTML = `
    <div class="dialog-body" style="--person-color:${color}">
      <div class="dialog-person">
        ${avatarMarkup(person)}
        <div>
          <h2>${escapeHtml(person.name)}</h2>
          <p>${escapeHtml(person.headline || "相关内容作者")} · ${escapeHtml(cluster.name)}</p>
        </div>
      </div>

      <section class="dialog-section">
        <h3>为什么推荐 TA</h3>
        <div class="reason-box"><p>${escapeHtml(person.connectionReason)}</p></div>
      </section>

      <section class="dialog-section">
        <h3>来自公开内容的交流起点</h3>
        <div class="quote-box">
          <blockquote>“${escapeHtml(person.quote?.text || evidence?.excerpt || "暂无可引用内容")}”</blockquote>
          <cite>${escapeHtml(evidence?.title || "内容来源整理中")}${evidence?.isSynthetic ? " · 演示内容" : " · 内容节选"}</cite>
        </div>
        <div class="dialog-actions">
          <a class="outline-button" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a>
          <button id="generateDrafts" class="outline-button primary" type="button">生成破冰问题</button>
        </div>
      </section>

      <section id="icebreakerArea" class="icebreaker-area" hidden></section>
    </div>
  `;

  elements.dialog.showModal();
  document.querySelector("#generateDrafts").addEventListener("click", (event) => {
    generateDrafts(event.currentTarget, person, evidence);
  });
}

async function generateDrafts(button, person, evidence) {
  button.disabled = true;
  button.textContent = "正在准备开场白…";

  try {
    await delay(350);
    renderDrafts([
      { label: "真诚请教", text: `你好，我最近在思考“${state.result.question}”。看到你提到“${person.quote?.text || evidence?.excerpt || "这个判断"}”，很受启发。你当时是如何验证这个判断的？` },
      { label: "具体追问", text: `你好，关于“${state.result.question}”，我很认同你从${person.recommendationType || "这个角度"}切入的看法。对于刚开始尝试的人，你觉得第一步最值得投入的行动是什么？` },
      { label: "分享经历", text: `你好，我也在探索“${state.result.question}”。你的分享让我重新想到自己的经历：我现在最犹豫的是如何平衡机会与风险。想请教你会怎样做一个低成本的验证？` }
    ]);
    button.textContent = "已生成 3 种风格";
  } catch (error) {
    button.disabled = false;
    button.textContent = "重新生成";
    showToast(error.message);
  }
}

function renderDrafts(drafts) {
  const area = document.querySelector("#icebreakerArea");
  area.hidden = false;
  area.innerHTML = `
    <h3>选择一种开场方式</h3>
    <p>所有草稿都基于同一条公开内容证据，你可以继续修改。</p>
    <div class="draft-tabs"></div>
    <textarea class="draft-editor" maxlength="500" aria-label="可编辑的破冰草稿"></textarea>
    <div class="dialog-actions">
      <button id="copyDraft" class="outline-button primary" type="button">复制草稿</button>
    </div>
    <p class="review-note">发送前请再次核对原文和语气；知路不会自动代你发布。</p>
  `;

  const tabs = area.querySelector(".draft-tabs");
  const editor = area.querySelector(".draft-editor");

  function selectDraft(index) {
    editor.value = drafts[index].text;
    [...tabs.children].forEach((tab, tabIndex) => tab.classList.toggle("active", tabIndex === index));
  }

  drafts.forEach((draft, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "draft-tab";
    tab.textContent = draft.label;
    tab.addEventListener("click", () => selectDraft(index));
    tabs.append(tab);
  });

  selectDraft(0);
  area.querySelector("#copyDraft").addEventListener("click", () => copyText(editor.value));
  area.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast("草稿已复制，发送前记得再看一遍。");
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function restart() {
  if (elements.dialog.open) elements.dialog.close();
  elements.results.hidden = true;
  elements.progress.hidden = true;
  elements.hero.hidden = false;
  elements.restart.hidden = true;
  state.result = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
  elements.input.focus();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuestion(elements.input.value.trim());
});

elements.input.addEventListener("input", updateCharCount);
document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.input.value = button.dataset.question;
    updateCharCount();
    elements.input.focus();
  });
});

elements.restart.addEventListener("click", restart);
elements.bottomRestart.addEventListener("click", restart);
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

updateCharCount();
checkHealth();
/* voyage */(()=>{let seen=[];let rr=renderResult;renderResult=()=>{rr();let a=document.querySelector('.closing-section')||elements.results;if(a&&!a.querySelector('.trail')){let b=document.createElement('button');b.className='secondary-button trail';b.textContent='结束本次探索 · 生成航线';b.onclick=show;a.prepend(b)}};let ei=enterIsland;enterIsland=async i=>{let c=state.result.clusters[i];if(c&&!seen.includes(c.name))seen.push(c.name);return ei(i)};let sq=submitQuestion;submitQuestion=async q=>{seen=[];return sq(q)};function show(){if(!seen.length)return showToast('先点击一座岛屿，再生成航线。');let d=document.createElement('dialog');d.style.cssText='max-width:880px;border:2px solid #b18c51;border-radius:22px;background:#fbf2df;color:#284433;padding:28px';d.innerHTML='<button style="float:right;border:0;background:none;font-size:28px">×</button><p style="text-align:center">知路 · 探索回顾</p><h2 style="text-align:center">你的探索航线</h2><p style="text-align:center">'+seen.length+' 座观点岛 · ⛵ 正在沿航线行驶</p><div style="border-top:3px dashed #967238;margin:45px 8%;position:relative"><i style="font-size:34px;display:block;animation:s 5s ease-in-out infinite">⛵</i></div><section><b>本次探索收获</b><p>已看过：'+seen.join('、')+'。下一步可继续认识岛上的人。</p><button class="outline-button primary">换一个问题</button></section><style>@keyframes s{50%{transform:translateX(55vw) rotate(5deg)}}</style>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.querySelector('.primary').onclick=()=>{d.close();restart()};d.onclose=()=>d.remove();d.showModal()}document.addEventListener('click',e=>{if(e.target.closest('#restartButton,#bottomRestart')&&state.result){e.preventDefault();e.stopImmediatePropagation();show()}},true)})();
