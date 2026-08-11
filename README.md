# OCR-Security

Tu dong boc tach thong tin tu anh **Giay phep lai xe (GPLX)** va **Giay chung nhan bao hiem xe cu**
ma khach hang gui qua Zalo, luu vao **Google Sheets**, va quan ly **han muc OCR** theo tung
nhan vien kinh doanh (NVKD) va toan cong ty.

## Luong hoat dong (flow)

```
KH --(gui anh)--> NVKD --(forward anh)--> Zalo ca nhan cua Admin (da dang nhap vao he thong)
                                                    |
                                                    v
                                    Bot lang nghe tin nhan tren Zalo Admin
                                                    |
                                    Anh --> Gemini OCR (doc ca chu in + chu viet tay)
                                                    |
                                    Kiem tra han muc NVKD + han muc cong ty
                                                    |
                                    Ghi ket qua vao Google Sheets (tab GPLX / BaoHiem)
                                                    |
                                    Tra loi lai NVKD ngay trong hoi thoai Zalo
```

NVKD nhan tin "han muc" hoac `/quota` toi Zalo cua Admin de tu tra soat han muc con lai.
Admin dung cac lenh `/quota all`, `/setquota`, `/setcompanyquota`, `/active` de quan ly.

## Kien truc

```
src/
  config.ts            Doc bien moi truong
  db/                   SQLite (better-sqlite3): employees, usage_logs, company_config
  quota/quotaService.ts Logic han muc (kiem tra + tru han muc ca nhan & cong ty)
  ocr/                   Goi Gemini API, prompt boc tach, validate JSON tra ve (zod)
  sheets/                Ghi du lieu vao Google Sheets (googleapis)
  zalo/                  Ket noi Zalo ca nhan (zca-js), parse lenh, doc anh tu tin nhan
  pipeline/ocrPipeline.ts  Dieu phoi: kiem tra han muc -> OCR -> ghi sheet -> tru han muc -> tra loi
  index.ts               Bootstrap ung dung
```

## Yeu cau

- Node.js >= 20 (khuyen nghi 22)
- Tai khoan Zalo ca nhan de lam "nick Admin" (khong phai Zalo OA)
- Gemini API key (Google AI Studio: https://aistudio.google.com/apikey)
- Google Cloud service account co quyen truy cap Google Sheets API

## Cai dat

```bash
npm install
cp .env.example .env
```

Dien vao `.env`:

| Bien | Y nghia |
|---|---|
| `GEMINI_API_KEY` | API key tu Google AI Studio |
| `GEMINI_MODEL` | Mac dinh `gemini-2.5-flash` (doi sang `gemini-2.5-pro` neu can do chinh xac cao hon voi chu viet tay kho doc) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Duong dan file JSON cua Google Cloud service account |
| `GOOGLE_SHEET_ID` | ID cua Google Sheet dich (trong URL) |
| `ZALO_SESSION_DIR` | Thu muc luu session dang nhap Zalo, tranh phai quet QR moi lan chay |
| `DATABASE_FILE` | Duong dan file SQLite |
| `COMPANY_MONTHLY_QUOTA` | Han muc OCR toan cong ty / thang |
| `DEFAULT_EMPLOYEE_MONTHLY_QUOTA` | Han muc mac dinh cap cho 1 NVKD moi khi lien he lan dau |
| `ADMIN_ZALO_IDS` | Danh sach zalo_id cua (cac) Admin, cach nhau boi dau phay - co quyen dung lenh quan tri |

### Thiet lap Google Sheets

1. Tao project tren Google Cloud Console, bat **Google Sheets API**.
2. Tao **Service Account**, tai file JSON key, dat vao duong dan trong `GOOGLE_SERVICE_ACCOUNT_FILE`.
3. Tao 1 Google Sheet moi, **Share** sheet do cho email cua service account (dang trong file JSON, dang `xxx@xxx.iam.gserviceaccount.com`) voi quyen **Editor**.
4. Lay `GOOGLE_SHEET_ID` tu URL: `https://docs.google.com/spreadsheets/d/<GOOGLE_SHEET_ID>/edit`.
5. Ung dung se tu tao 2 tab (`GPLX`, `BaoHiem`) va dong tieu de neu chua co.

### Dang nhap Zalo (tai khoan Admin)

Lan chay dau tien, ung dung se hien **QR code** (luu tai `zalo-session/qr.png` va in ra terminal) -
dung app Zalo tren dien thoai cua Admin de quet. Sau khi dang nhap thanh cong, session duoc luu lai
trong `ZALO_SESSION_DIR`, cac lan chay sau khong can quet QR nua (den khi session het han).

Sau khi dang nhap, lay `zalo_id` cua Admin (co the log ra tu `api.getOwnId()`) va dien vao
`ADMIN_ZALO_IDS` trong `.env`.

## Chay ung dung

```bash
npm run dev     # chay bang tsx, tu reload khi sua code
npm run build && npm start   # build production roi chay
npm test        # chay unit test
npm run typecheck
```

## Quan ly han muc OCR - cac lenh nhan tin toi Zalo Admin

**NVKD:**
- `han muc` hoac `/quota`: xem han muc OCR con lai cua chinh minh
- Gui anh GPLX / giay bao hiem xe de OCR tu dong

**Admin (zalo_id nam trong `ADMIN_ZALO_IDS`):**
- `/quota all`: xem han muc tat ca NVKD
- `/quota <ten NVKD>` hoac `han muc <ten NVKD>`: xem han muc 1 NVKD
- `han muc cong ty`: xem han muc toan cong ty
- `/setquota <ten NVKD> <so luot>`: cap han muc thang cho 1 NVKD
- `/setcompanyquota <so luot>`: cap han muc thang cho toan cong ty
- `/active <ten NVKD> on|off`: bat/tat quyen OCR cua 1 NVKD

Han muc duoc tinh theo thang (reset tu nhien vi chi dem so lan OCR **thanh cong** trong thang hien tai,
khong can job dat lai). Han muc bi chan neu **het han muc ca nhan HOAC het han muc cong ty**
(kiem tra ca hai dieu kien).

## ⚠️ Luu y quan trong ve rui ro

- **Zalo khong co API chinh thuc cho tai khoan ca nhan.** Du an dung thu vien khong chinh thuc
  [`zca-js`](https://github.com/RFS-ADRENO/zca-js) mo phong Zalo Web. Zalo co the phat hien va
  **khoa tai khoan** dung theo cach nay bat cu luc nao - **khong dung tai khoan Zalo chinh/quan trong**
  cho "nick Admin", va can nguoi that thinh thoang tuong tac binh thuong de giam rui ro bi danh dau bot.
  Neu can do on dinh lau dai/quy mo lon, nen chuyen sang **Zalo Official Account (OA)** voi API chinh thuc.
- **Du lieu ca nhan nhay cam:** GPLX va giay bao hiem chua CMND/CCCD, ho ten, ngay sinh, dia chi -
  thuoc pham vi **du lieu ca nhan** theo Nghi dinh 13/2023/ND-CP. Can gioi han quyen truy cap Google
  Sheet (chi Admin/nguoi co trach nhiem), can nhac ma hoa/xoa du lieu khi khong con can thiet, va co
  thong bao/dong y phu hop voi khach hang.
- **File session Zalo va service account JSON** trong `zalo-session/` va `credentials/` tuong duong
  quyen dang nhap tai khoan - **khong commit vao git** (da them vao `.gitignore`), bao mat nhu mat khau.

## OCR: Gemini (tra phi) vs cac lua chon mien phi

Yeu cau doc duoc **chu viet tay** (vi du ngay hieu luc/so hop dong bao hiem do dai ly ghi tay) loai
gan het cac OCR engine truyen thong mien phi:

| Giai phap | Chi phi | Doc chu viet tay | Ghi chu |
|---|---|---|---|
| **Gemini 2.5 Flash/Pro** (dang dung) | Tra phi theo token, co free tier gioi han | Tot | Model da ngon ngu, hieu ngu canh giay to VN, tra ve JSON co cau truc |
| Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) | Free tier 1000 don vi/thang, sau do tra phi | Trung binh | Doc chu in tot, chu viet tay kem hon Gemini nhieu |
| Tesseract.js / Tesseract OCR | Mien phi, chay local | Kem | Gan nhu khong doc duoc chu viet tay, chi hop voi chu in ro net |

**Khuyen nghi MVP:** dung Gemini nhu hien tai. Neu muon giam chi phi, co the: (1) dung
`gemini-2.5-flash` (re hon `pro`) cho da so truong hop, (2) chi goi lai `pro` khi `flash` tra ve
`confidence` thap hoac nhieu `lowConfidenceFields`, (3) theo doi chi phi qua he thong han muc san co
trong du an nay.

## Gioi han cua MVP / huong mo rong

- Chi xu ly chat 1-1 (User), chua ho tro group.
- Sheets API goi tuan tu (chua batch), du dung cho quy mo NVKD vua/nho.
- Chua co retry/queue khi Gemini hoac Google Sheets tam thoi loi (hien tai bao loi va khong tru han
  muc, NVKD gui lai anh la duoc).
- Danh gia can nhac chuyen sang Zalo OA + webhook chinh thuc khi mo rong quy mo hoac can do on dinh cao.
