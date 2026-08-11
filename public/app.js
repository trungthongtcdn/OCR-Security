async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Loi HTTP ${res.status}`);
  }
  return data;
}

function showSaveMsg(formId, text, isError) {
  const el = document.querySelector(`.save-msg[data-for="${formId}"]`);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
  setTimeout(() => { el.textContent = ""; }, 4000);
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "settings") loadSettings();
    if (btn.dataset.tab === "employees") loadEmployees();
    if (btn.dataset.tab === "logs") loadLogs();
  });
});

// ---------- Zalo status ----------
const ZALO_STATE_LABELS = {
  logged_out: "Chua ket noi",
  connecting: "Dang ket noi...",
  qr_pending: "Cho quet QR...",
  logged_in: "Da ket noi",
};

async function refreshZaloStatus() {
  let data;
  try {
    data = await api("/api/status");
  } catch (err) {
    return;
  }
  const { zalo } = data;
  const box = document.getElementById("zalo-status");
  const qrWrap = document.getElementById("zalo-qr-wrap");
  const qrImg = document.getElementById("zalo-qr");
  const btnLogin = document.getElementById("btn-zalo-login");
  const btnLogout = document.getElementById("btn-zalo-logout");

  box.className = "status-box";
  if (zalo.state === "logged_in") {
    box.classList.add("ok");
    box.textContent = `Da ket noi Zalo${zalo.ownName ? " - " + zalo.ownName : ""} (id: ${zalo.ownId || "?"})`;
    qrWrap.classList.add("hidden");
    btnLogin.classList.add("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    box.classList.add(zalo.error ? "error" : "warn");
    box.textContent = zalo.error
      ? `Loi: ${zalo.error}`
      : ZALO_STATE_LABELS[zalo.state] || zalo.state;
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    if (zalo.state === "qr_pending" && zalo.qrDataUrl) {
      qrImg.src = zalo.qrDataUrl;
      qrWrap.classList.remove("hidden");
    } else {
      qrWrap.classList.add("hidden");
    }
  }
}

document.getElementById("btn-zalo-login").addEventListener("click", async () => {
  await api("/api/zalo/login", { method: "POST" });
  refreshZaloStatus();
});
document.getElementById("btn-zalo-logout").addEventListener("click", async () => {
  if (!confirm("Dang xuat tai khoan Zalo dang ket noi?")) return;
  await api("/api/zalo/logout", { method: "POST" });
  refreshZaloStatus();
});

setInterval(refreshZaloStatus, 2500);
refreshZaloStatus();

// ---------- Settings ----------
async function loadSettings() {
  const s = await api("/api/settings");

  const keyBadge = document.getElementById("gemini-key-status");
  keyBadge.textContent = s.geminiApiKeySet ? "Da cau hinh" : "Chua cau hinh";
  keyBadge.className = "badge " + (s.geminiApiKeySet ? "ok" : "missing");
  document.getElementById("gemini-model").value = s.geminiModel;

  document.getElementById("sheet-id").value = s.googleSheetId;
  document.getElementById("sheet-tab").value = s.sheetTab;
  document.getElementById("vision-cross-check-enabled").checked = Boolean(s.visionCrossCheckEnabled);

  const saBadge = document.getElementById("sa-status");
  saBadge.textContent = s.googleServiceAccountSet ? "Da cau hinh" : "Chua cau hinh";
  saBadge.className = "badge " + (s.googleServiceAccountSet ? "ok" : "missing");
  document.getElementById("sa-email-hint").textContent = s.googleServiceAccountEmail
    ? `Email service account: ${s.googleServiceAccountEmail} - nho Share Google Sheet cho email nay.`
    : "";

  document.getElementById("company-quota").value = s.companyMonthlyQuota;
  document.getElementById("default-employee-quota").value = s.defaultEmployeeMonthlyQuota;
}

document.getElementById("form-gemini").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const body = { geminiModel: document.getElementById("gemini-model").value };
    const key = document.getElementById("gemini-api-key").value.trim();
    if (key) body.geminiApiKey = key;
    await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    document.getElementById("gemini-api-key").value = "";
    showSaveMsg("form-gemini", "Da luu.");
    loadSettings();
  } catch (err) {
    showSaveMsg("form-gemini", err.message, true);
  }
});

document.getElementById("form-sheets").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const body = {
      googleSheetId: document.getElementById("sheet-id").value.trim(),
      sheetTab: document.getElementById("sheet-tab").value.trim(),
    };
    const sa = document.getElementById("sa-json").value.trim();
    if (sa) body.googleServiceAccountJson = sa;
    await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    document.getElementById("sa-json").value = "";
    showSaveMsg("form-sheets", "Da luu.");
    loadSettings();
  } catch (err) {
    showSaveMsg("form-sheets", err.message, true);
  }
});

document.getElementById("form-vision").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const body = {
      visionCrossCheckEnabled: document.getElementById("vision-cross-check-enabled").checked,
    };
    await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    showSaveMsg("form-vision", "Da luu.");
  } catch (err) {
    showSaveMsg("form-vision", err.message, true);
  }
});

document.getElementById("form-quota").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const body = {
      companyMonthlyQuota: Number(document.getElementById("company-quota").value),
      defaultEmployeeMonthlyQuota: Number(document.getElementById("default-employee-quota").value),
    };
    await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    showSaveMsg("form-quota", "Da luu.");
  } catch (err) {
    showSaveMsg("form-quota", err.message, true);
  }
});

// ---------- Test OCR ----------
const testOcrFileInput = document.getElementById("test-ocr-file");
const testOcrPreviewWrap = document.getElementById("test-ocr-preview-wrap");
const testOcrPreview = document.getElementById("test-ocr-preview");
const btnTestOcr = document.getElementById("btn-test-ocr");
const testOcrResult = document.getElementById("test-ocr-result");

let testOcrImageBase64 = "";
let testOcrMimeType = "";

const TEST_OCR_DOC_TYPE_LABELS = {
  vehicle_registration: "Dang ky xe",
  insurance: "Bao hiem xe",
  unknown: "Khong xac dinh",
};

const TEST_OCR_FIELDS = [
  ["vehiclePlate", "Bien so xe"],
  ["vehicleType", "Loai xe"],
  ["seatCount", "So cho ngoi"],
  ["ownerName", "Ho ten chu xe"],
  ["address", "Dia chi"],
  ["chassisNumber", "So khung"],
  ["engineNumber", "So may"],
  ["loadCapacity", "Tai trong"],
];

testOcrFileInput.addEventListener("change", () => {
  const file = testOcrFileInput.files[0];
  testOcrResult.classList.add("hidden");
  testOcrImageBase64 = "";
  if (!file) {
    testOcrPreviewWrap.classList.add("hidden");
    btnTestOcr.disabled = true;
    return;
  }
  testOcrMimeType = file.type || "image/jpeg";
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    testOcrImageBase64 = dataUrl.split(",")[1] || "";
    testOcrPreview.src = dataUrl;
    testOcrPreviewWrap.classList.remove("hidden");
    btnTestOcr.disabled = false;
  };
  reader.readAsDataURL(file);
});

btnTestOcr.addEventListener("click", async () => {
  if (!testOcrImageBase64) return;
  btnTestOcr.disabled = true;
  btnTestOcr.textContent = "Dang doc...";
  testOcrResult.classList.remove("hidden");
  testOcrResult.innerHTML = "Dang goi Gemini, co the mat vai giay...";
  try {
    const { result } = await api("/api/ocr/test", {
      method: "POST",
      body: JSON.stringify({ imageBase64: testOcrImageBase64, mimeType: testOcrMimeType }),
    });
    renderTestOcrResult(result);
  } catch (err) {
    testOcrResult.innerHTML = `<span class="save-msg error">${escapeHtml(err.message)}</span>`;
  } finally {
    btnTestOcr.disabled = false;
    btnTestOcr.textContent = "Doc thu anh nay";
  }
});

function renderTestOcrResult(result) {
  const label = TEST_OCR_DOC_TYPE_LABELS[result.documentType] || result.documentType;
  if (result.documentType === "unknown") {
    testOcrResult.innerHTML = `
      <p><strong>${escapeHtml(label)}</strong></p>
      <p class="hint">Anh nay KHONG duoc nhan dien la Giay dang ky xe hoac Giay chung nhan bao hiem
      xe - trong luong xu ly that qua Zalo, he thong se bo qua anh nay va KHONG tra loi NVKD.</p>
    `;
    return;
  }
  const f = result.vehicle || {};
  const low = new Set(result.lowConfidenceFields || []);
  const rowsHtml = TEST_OCR_FIELDS.map(([key, vnLabel]) => {
    const flagged = low.has(key);
    return `
      <tr${flagged ? ' style="background:#fffbeb;"' : ""}>
        <td>${escapeHtml(vnLabel)}${flagged ? ' <span class="badge missing">can kiem tra</span>' : ""}</td>
        <td>${escapeHtml(f[key] || "")}</td>
      </tr>
    `;
  }).join("");
  const crossCheckHtml = (result.crossCheckNotes || []).length > 0 ? `
    <div class="status-box warn" style="margin-top: 10px;">
      <strong>Cloud Vision doi chieu phat hien khac biet:</strong>
      <ul style="margin: 6px 0 0; padding-left: 18px;">
        ${result.crossCheckNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
      </ul>
    </div>
  ` : "";
  testOcrResult.innerHTML = `
    <p><strong>Loai giay to:</strong> ${escapeHtml(label)}
      &nbsp; <strong>Do tin cay:</strong> ${Math.round((result.confidence || 0) * 100)}%</p>
    <table class="data-table"><tbody>${rowsHtml}</tbody></table>
    ${crossCheckHtml}
    ${result.rawText ? `
      <details style="margin-top: 10px;">
        <summary class="hint">Xem toan bo van ban Gemini doc duoc (rawText)</summary>
        <p class="hint" style="white-space: pre-wrap;">${escapeHtml(result.rawText)}</p>
      </details>
    ` : ""}
  `;
}

// ---------- Employees ----------
let allEmployees = [];

async function loadEmployees() {
  const { month, employees } = await api("/api/employees");
  document.getElementById("current-month").textContent = month;
  allEmployees = employees;
  renderEmployeeTable();
}

function renderEmployeeTable() {
  const query = document.getElementById("employee-search").value.trim().toLowerCase();
  const filtered = query
    ? allEmployees.filter(
        (e) => e.name.toLowerCase().includes(query) || e.zaloId.toLowerCase().includes(query),
      )
    : allEmployees;

  const tbody = document.getElementById("employee-tbody");
  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="hint">${allEmployees.length === 0 ? "Chua co NVKD nao." : "Khong tim thay ket qua."}</td></tr>`;
    return;
  }
  for (const emp of filtered) {
    const tr = document.createElement("tr");
    if (!emp.active) tr.classList.add("inactive");
    tr.innerHTML = `
      <td>${escapeHtml(emp.name)}</td>
      <td>${escapeHtml(emp.zaloId)}</td>
      <td><input type="number" min="0" value="${emp.monthlyQuota}" data-field="monthlyQuota" /></td>
      <td>${emp.used}</td>
      <td>${emp.remaining}</td>
      <td><input type="checkbox" data-field="active" ${emp.active ? "checked" : ""} /></td>
      <td><input type="checkbox" data-field="isAdmin" ${emp.isAdmin ? "checked" : ""} /></td>
      <td><button class="btn btn-save-emp">Luu</button></td>
    `;
    tr.querySelector(".btn-save-emp").addEventListener("click", async () => {
      const monthlyQuota = Number(tr.querySelector('[data-field="monthlyQuota"]').value);
      const active = tr.querySelector('[data-field="active"]').checked;
      const isAdmin = tr.querySelector('[data-field="isAdmin"]').checked;
      try {
        await api(`/api/employees/${emp.id}`, {
          method: "PUT",
          body: JSON.stringify({ monthlyQuota, active, isAdmin }),
        });
        loadEmployees();
      } catch (err) {
        alert(err.message);
      }
    });
    tbody.appendChild(tr);
  }
}

document.getElementById("employee-search").addEventListener("input", renderEmployeeTable);

// -- Cach 1: tim theo so dien thoai --
document.getElementById("btn-lookup-phone").addEventListener("click", async () => {
  const phone = document.getElementById("lookup-phone").value.trim();
  const resultBox = document.getElementById("lookup-result");
  if (!phone) return;
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = "Dang tim...";
  try {
    const { user } = await api(`/api/zalo/find-user?phone=${encodeURIComponent(phone)}`);
    resultBox.innerHTML = `
      <p>Tim thay: <strong>${escapeHtml(user.displayName)}</strong> (Zalo ID: ${escapeHtml(user.uid)})</p>
      <label>Han muc/thang <input type="number" min="0" id="lookup-quota" placeholder="De trong = dung han muc mac dinh" /></label>
      <label class="checkbox"><input type="checkbox" id="lookup-is-admin" /> La Admin (duoc dung lenh quan tri qua Zalo)</label>
      <button id="btn-lookup-confirm-add" class="btn btn-primary" type="button">Them NVKD nay</button>
    `;
    document.getElementById("btn-lookup-confirm-add").addEventListener("click", async () => {
      const quotaRaw = document.getElementById("lookup-quota").value;
      const isAdmin = document.getElementById("lookup-is-admin").checked;
      try {
        const body = { zaloId: user.uid, name: user.displayName, isAdmin };
        if (quotaRaw) body.monthlyQuota = Number(quotaRaw);
        await api("/api/employees", { method: "POST", body: JSON.stringify(body) });
        resultBox.classList.add("hidden");
        document.getElementById("lookup-phone").value = "";
        loadEmployees();
      } catch (err) {
        alert(err.message);
      }
    });
  } catch (err) {
    resultBox.innerHTML = `<span class="save-msg error">${escapeHtml(err.message)}</span>`;
  }
});

// -- Cach 2: nhap Zalo ID truc tiep --
document.getElementById("form-add-employee").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zaloId = document.getElementById("new-zalo-id").value.trim();
  const name = document.getElementById("new-name").value.trim();
  const quotaRaw = document.getElementById("new-quota").value;
  const isAdmin = document.getElementById("new-is-admin").checked;
  try {
    const body = { zaloId, name, isAdmin };
    if (quotaRaw) body.monthlyQuota = Number(quotaRaw);
    await api("/api/employees", { method: "POST", body: JSON.stringify(body) });
    document.getElementById("form-add-employee").reset();
    showSaveMsg("form-add-employee", "Da them.");
    loadEmployees();
  } catch (err) {
    showSaveMsg("form-add-employee", err.message, true);
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Logs ----------
async function loadLogs() {
  const { logs } = await api("/api/usage?limit=100");
  const tbody = document.getElementById("logs-tbody");
  tbody.innerHTML = "";
  for (const log of logs) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(log.createdAt.replace(" ", "T") + "Z").toLocaleString("vi-VN")}</td>
      <td>${escapeHtml(log.employeeName)}</td>
      <td>${escapeHtml(log.docType)}</td>
      <td><span class="status-tag ${log.status}">${log.status}</span></td>
      <td>${escapeHtml(log.detail || "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById("btn-refresh-logs").addEventListener("click", loadLogs);
