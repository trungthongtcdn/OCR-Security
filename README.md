# OCR-Security

Tu dong boc tach thong tin tu anh **Giay dang ky xe (ca vet)** va **Giay chung nhan bao hiem xe**
ma khach hang gui qua Zalo, luu vao **1 Google Sheet duy nhat**, va quan ly **han muc OCR** theo
tung nhan vien kinh doanh (NVKD) va toan cong ty. Anh khac 2 loai giay to nay (CMND/CCCD, GPLX,
anh ca nhan khong lien quan...) se **bi bo qua hoan toan, khong tra loi** - tranh gay nhieu khi
NVKD/KH nhan tin ca nhan qua lai qua cung nick Zalo Admin.

## Luong hoat dong (flow)

```
KH --(gui anh)--> NVKD --(forward anh)--> Zalo ca nhan cua Admin (da dang nhap vao he thong)
                                                    |
                                                    v
                                    Bot lang nghe tin nhan tren Zalo Admin
                                                    |
                                    Anh --> Gemini OCR (doc ca chu in + chu viet tay,
                                             tu dong doc lai bang model manh hon neu nghi ngo)
                                                    |
                                    Khong phai Dang ky xe/Bao hiem xe? --> bo qua, khong tra loi
                                                    |
                                    Kiem tra han muc NVKD + han muc cong ty
                                                    |
                                    Ghi ket qua vao 1 Google Sheet (co cot "Loai giay to")
                                                    |
                                    Tra loi lai NVKD ngay trong hoi thoai Zalo (du 8 truong)
```

Toan bo cau hinh (Gemini API key, Google Sheets, dang nhap Zalo, han muc, danh sach NVKD/Admin)
duoc thiet lap qua **trang Admin** chay kem theo ung dung - khong can sua file `.env` hay code.

NVKD nhan tin "han muc" hoac `/quota` toi Zalo cua Admin de tu tra soat han muc con lai.
Admin quan ly moi thu qua trang web (xem [Trang Admin](#trang-admin)), hoac dung cac lenh
`/quota all`, `/setquota`, `/setcompanyquota`, `/active` ngay tren Zalo.

## Kien truc

```
src/
  config.ts                Doc bien moi truong ha tang (PORT, mat khau Admin, duong dan file...)
  db/                       SQLite (better-sqlite3): employees, usage_logs, company_config, settings
  db/settingsRepo.ts        Cau hinh nghiep vu (Gemini, Sheets, han muc) - doc/ghi qua trang Admin
  quota/quotaService.ts     Logic han muc (kiem tra + tru han muc ca nhan & cong ty)
  ocr/                       Goi Gemini API, prompt boc tach, validate JSON tra ve (zod)
  sheets/                    Ghi du lieu vao Google Sheets (googleapis)
  zalo/zaloSession.ts        Quan ly dang nhap Zalo (QR, session, trang thai) qua zca-js
  zalo/messageRouter.ts      Dieu huong tin nhan: anh -> OCR, text -> lenh han muc
  runtime/serviceRegistry.ts Tu dong build lai Gemini/Sheets client khi Admin doi cau hinh
  web/server.ts              Express: API cho trang Admin (co Basic Auth)
  index.ts                   Bootstrap: mo DB, phuc hoi session Zalo, chay web server
public/                     Frontend trang Admin (HTML/CSS/JS thuan, khong can build)
```

## Yeu cau

- Node.js >= 20 (khuyen nghi 22)
- Tai khoan Zalo ca nhan de lam "nick Admin" (khong phai Zalo OA)
- Gemini API key (Google AI Studio: https://aistudio.google.com/apikey) - dien qua trang Admin
- Google Cloud service account co quyen truy cap Google Sheets API - dien qua trang Admin

## Cai dat

```bash
npm install
cp .env.example .env
```

`.env` chi con cau hinh **ha tang**, khong lien quan nghiep vu:

| Bien | Y nghia |
|---|---|
| `PORT` | Cong chay trang Admin (mac dinh 4000) |
| `ADMIN_PANEL_USER` / `ADMIN_PANEL_PASSWORD` | Tai khoan dang nhap trang Admin (HTTP Basic Auth). **De trong `ADMIN_PANEL_PASSWORD` = khong yeu cau dang nhap** (mac dinh, de test nhanh); dien mat khau vao de bat lai dang nhap |
| `DATABASE_FILE` | Duong dan file SQLite (luu ca cau hinh, han muc, NVKD, nhat ky OCR) |
| `ZALO_SESSION_DIR` | Thu muc luu session dang nhap Zalo, tranh phai quet QR moi lan chay |

```bash
npm run build && npm start   # hoac: npm run dev de chay bang tsx (tu reload)
```

Mo trinh duyet toi `http://localhost:4000` (hoac IP:PORT cua server). Mac dinh **khong can dang nhap**
(vao thang trang Admin); neu da dien `ADMIN_PANEL_PASSWORD` trong `.env` thi dang nhap bang
`ADMIN_PANEL_USER` / `ADMIN_PANEL_PASSWORD`.

> ⚠️ Khi chua dien `ADMIN_PANEL_PASSWORD`, **bat ky ai co duong dan** toi trang Admin deu xem/sua
> duoc Gemini API key, thong tin Google Sheets, han muc va dang nhap Zalo. Chi de o che do mo nay
> khi chay tren may ca nhan hoac mang noi bo tin cay; neu dua server ra internet (Railway, VPS...),
> **bat buoc dien mat khau** truoc.

## Trang Admin

Trang Admin co 5 tab:

1. **Ket noi Zalo** - bam "Dang nhap Zalo", quet QR bang app Zalo tren dien thoai cua Admin.
   Trang tu poll trang thai (dang cho quet / da ket noi) moi 2.5 giay. Sau khi dang nhap, session
   duoc luu vao `ZALO_SESSION_DIR`, lan sau khoi dong app se tu ket noi lai (khong can quet QR),
   tru khi Admin bam "Dang xuat".
2. **Cau hinh he thong**:
   - **Gemini**: dan API key (lay tai https://aistudio.google.com/apikey) va chon model.
   - **Google Sheets**: dien Google Sheet ID (trong URL sheet), ten 1 tab luu du lieu (dung chung
     cho ca dang ky xe va bao hiem, phan biet bang cot "Loai giay to"), va **dan noi dung file JSON
     cua Google service account** vao o van ban (khong can upload file, khong can dat file tren
     server). Trang se hien email cua service account de ban **Share** Google Sheet cho email do
     voi quyen Editor. Ung dung tu tao tab + dong tieu de neu chua co.
   - **Han muc mac dinh**: han muc toan cong ty / thang va han muc mac dinh cho 1 NVKD moi.
3. **Test OCR**: **tai anh len truc tiep tu trinh duyet** de xem thu Gemini doc duoc gi (loai giay
   to, do tin cay, du 8 truong, truong nao bi danh dau "can kiem tra"), **khong can gui qua Zalo**.
   Tinh nang nay KHONG tru han muc NVKD va KHONG ghi vao Google Sheet - chi de kiem tra chat luong
   doc/thu prompt truoc khi dung that. Can cau hinh xong Gemini API key o tab 2 truoc.
4. **NVKD & han muc**: bang danh sach NVKD (tu dong xuat hien sau khi ho nhan tin lan dau). Admin
   khong can biet/nhap Zalo ID thu cong - co the **them NVKD bang so dien thoai**, he thong tu tra
   ra Zalo ID va ten (yeu cau da ket noi Zalo o tab 1); cach nhap Zalo ID truc tiep van con nhung
   dat trong muc "nang cao" cho truong hop can thiet. Bang co o **tim kiem theo ten/ID**. Sua han
   muc, bat/tat hoat dong, danh dau la Admin (cho phep dung lenh quan tri qua Zalo) - luu ngay tren bang.
5. **Nhat ky OCR**: xem cac lan OCR gan day (thanh cong/that bai) de kiem tra he thong hoat dong dung.

Cau hinh luu vao SQLite; moi lan Admin luu cau hinh Gemini/Sheets, he thong tu dong dung cau hinh
moi cho lan OCR tiep theo - **khong can restart app**.

### Thiet lap Google Sheets (chi tiet)

1. Tao project tren Google Cloud Console, bat **Google Sheets API**.
2. Tao **Service Account**, tai file JSON key.
3. Mo file JSON, copy toan bo noi dung, dan vao o "Service Account JSON" trong trang Admin.
4. Tao 1 Google Sheet moi, **Share** sheet do cho email service account (trang Admin se hien email
   nay sau khi luu, dang `xxx@xxx.iam.gserviceaccount.com`) voi quyen **Editor**.
5. Lay `GOOGLE_SHEET_ID` tu URL: `https://docs.google.com/spreadsheets/d/<GOOGLE_SHEET_ID>/edit`,
   dien vao trang Admin.

```bash
npm test        # chay unit test
npm run typecheck
```

## Quan ly han muc OCR - cac lenh nhan tin toi Zalo Admin

**NVKD:**
- `han muc` hoac `/quota`: xem han muc OCR con lai cua chinh minh
- Gui anh Giay dang ky xe (ca vet) hoac Giay chung nhan bao hiem xe de OCR tu dong. He thong tra ve
  du 8 truong: Bien so xe, Loai xe, So cho ngoi, Ho ten chu xe, Dia chi, So khung, So may, Tai trong.
  Anh khac 2 loai giay to nay se bi bo qua, khong tra loi.

**Admin (NVKD duoc danh dau "La Admin" trong trang quan tri):**
- `/quota all`: xem han muc tat ca NVKD
- `/quota <ten NVKD>` hoac `han muc <ten NVKD>`: xem han muc 1 NVKD
- `han muc cong ty`: xem han muc toan cong ty
- `/setquota <ten NVKD> <so luot>`: cap han muc thang cho 1 NVKD
- `/setcompanyquota <so luot>`: cap han muc thang cho toan cong ty
- `/active <ten NVKD> on|off`: bat/tat quyen OCR cua 1 NVKD

Tat ca cac lenh tren cung lam duoc qua trang Admin (tab "NVKD & han muc"), day chi la kenh thay the
nhanh khi dang chat san tren Zalo.

Han muc duoc tinh theo thang (reset tu nhien vi chi dem so lan OCR **thanh cong** trong thang hien tai,
khong can job dat lai). Han muc bi chan neu **het han muc ca nhan HOAC het han muc cong ty**
(kiem tra ca hai dieu kien).

## ⚠️ Luu y quan trong ve rui ro

- **Zalo khong co API chinh thuc cho tai khoan ca nhan.** Du an dung thu vien khong chinh thuc
  [`zca-js`](https://github.com/RFS-ADRENO/zca-js) mo phong Zalo Web. Zalo co the phat hien va
  **khoa tai khoan** dung theo cach nay bat cu luc nao - **khong dung tai khoan Zalo chinh/quan trong**
  cho "nick Admin", va can nguoi that thinh thoang tuong tac binh thuong de giam rui ro bi danh dau bot.
  Neu can do on dinh lau dai/quy mo lon, nen chuyen sang **Zalo Official Account (OA)** voi API chinh thuc.
- **Du lieu ca nhan nhay cam:** giay dang ky xe va giay bao hiem chua ho ten, dia chi, thong tin xe -
  thuoc pham vi **du lieu ca nhan** theo Nghi dinh 13/2023/ND-CP. Can gioi han quyen truy cap Google
  Sheet (chi Admin/nguoi co trach nhiem), can nhac ma hoa/xoa du lieu khi khong con can thiet, va co
  thong bao/dong y phu hop voi khach hang.
- **File session Zalo** (`zalo-session/`) va **file database** (`data/*.sqlite3`, chua ca API key
  Gemini va private key cua Google service account duoi dang van ban) tuong duong quyen dang nhap
  tai khoan - **khong commit vao git** (da them vao `.gitignore`), sao luu/bao mat nhu mat khau.
  Trang Admin dat sau HTTP Basic Auth - doi mat khau mac dinh va **chi mo cong `PORT` cho mang noi bo
  hoac dat sau VPN/reverse proxy co HTTPS** khi trien khai thuc te, vi Basic Auth gui mat khau ro
  qua HTTP se lo neu khong co TLS.

## OCR: Gemini (tra phi) vs cac lua chon mien phi

Yeu cau doc duoc **chu viet tay** (vi du ngay hieu luc/so hop dong bao hiem do dai ly ghi tay) loai
gan het cac OCR engine truyen thong mien phi:

| Giai phap | Chi phi | Doc chu viet tay | Ghi chu |
|---|---|---|---|
| **Gemini 3.6 Flash / 3.5 Flash** (dang dung) | Tra phi theo token, co free tier gioi han | Tot | Model da ngon ngu, hieu ngu canh giay to VN, tra ve JSON co cau truc |
| Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) | Free tier 1000 don vi/thang, sau do tra phi | Trung binh | Doc chu in tot, chu viet tay kem hon Gemini nhieu |
| Tesseract.js / Tesseract OCR | Mien phi, chay local | Kem | Gan nhu khong doc duoc chu viet tay, chi hop voi chu in ro net |

**Khuyen nghi MVP:** dung Gemini nhu hien tai, model mac dinh `gemini-3.6-flash`. Neu muon giam chi
phi hon nua, co the doi sang `gemini-3.5-flash-lite` trong tab Cau hinh he thong. Luu y: cac model
doi cu (`gemini-2.5-*`, `gemini-2.0-*`, `gemini-1.5-*`) da bi Google ngung phuc vu - he thong tu dong
chuyen ve `gemini-3.6-flash` neu phat hien cau hinh dang tro toi mot model da retired.

**Nang cao chat luong chu viet tay:** neu lan doc dau tien co truong nao Gemini tu danh dau "do tin
cay thap" (`lowConfidenceFields`, thuong roi vao chu viet tay), he thong **tu dong doc lai anh do
bang `gemini-3.6-flash`** (model manh nhat hien dang GA cua Google, tinh den luc viet code nay chua
co tang "Pro" GA cong khai de nang cap cao hon) va giu ket qua nao it truong nghi ngo hon - kho hon
la khong retry gi (neu Admin da chon san `gemini-3.6-flash` lam mac dinh thi khong doc lai, tranh
ton gap doi chi phi). Neu chat viet tay van sai nhieu sau khi da co retry nay, cach hieu qua nhat
tiep theo thuong la **cai thien chat luong anh dau vao** (chup thang, du sang, khong bi loa/mo) hon
la doi model - co the can nhac them buoc nhac NVKD chup lai neu anh qua mo/toi truoc khi OCR.

Rieng **so khung/so may** (ma chu+so dap/in, sai 1 ky tu la sai toan bo ma) de bi doc nham hon ca
chu viet tay thuong (vi du nham `O`/`0`, them/bot ky tu do font dap meo) - prompt da duoc day manh
canh bao cu the cac cap ky tu de nham, yeu cau doc tung ky tu va ha thap nguong "chac chan" rieng
cho 2 truong nay (de kich hoat retry som hon), bat "thinking" (`thinkingConfig`) de Gemini suy nghi
ky truoc khi tra loi thay vi doan nhanh, va giam `temperature` ve 0 de ket qua on dinh hon. Do day
la truong rui ro cao, tin nhan tra loi Zalo **luon** nhac NVKD doi chieu so khung/so may voi ban
goc truoc khi dung lam ho so chinh thuc, du Gemini co bao "chac chan" hay khong.

## Gioi han cua MVP / huong mo rong

- Chi xu ly chat 1-1 (User), chua ho tro group.
- Sheets API goi tuan tu (chua batch), du dung cho quy mo NVKD vua/nho.
- Chua co retry/queue khi Gemini hoac Google Sheets tam thoi loi (hien tai bao loi va khong tru han
  muc, NVKD gui lai anh la duoc).
- Danh gia can nhac chuyen sang Zalo OA + webhook chinh thuc khi mo rong quy mo hoac can do on dinh cao.
