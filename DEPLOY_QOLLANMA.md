# AYUB CLUB PRO — Toza Domen (`e2b` siz) Olish Qo‘llanmasi

Ushbu loyiha **1-klikda** bepul **Vercel + Supabase** platformalarida `https://ayub-club-pro.vercel.app` yoki shaxsiy `https://ayubparfum.uz` domeningizda 24/7 ishlaydigan qilib sozlangan.

## 1-qadam: Supabase PostgreSQL bazasini ochish (2 daqiqa, bepul)
1. [https://supabase.com](https://supabase.com) saytidan bepul hisob ochib **New Project** bosing (`ayub-club-pro`).
2. **Project Settings → Database → Connection string → URI** bo‘limidan `postgresql://...` havolasini nusxalab oling (`[YOUR-PASSWORD]` o‘rniga parolingizni yozing).
3. *(Terminalda hech narsa yozish shart emas — dastur birinchi marta ochilganda barcha 16 ta jadvalni avtomatik o‘zi yaratadi!)*

## 2-qadam: Vercel orqali toza havola olish (2 daqiqa, bepul)
1. Ushbu loyiha kodini yuklab olib GitHub profilingizga joylang.
2. [https://vercel.com](https://vercel.com) ga kirib **Add New → Project** bosing va GitHub repozitoriyangizni tanlang.
3. **Environment Variables** bo‘limiga quyidagilarni kiriting:
   - `DATABASE_URL` = *(1-qadamdagi Supabase URI)*
   - `SESSION_SECRET` = *(ixtiyoriy maxfiy so‘z, masalan: `ayubparfum2026secret`)*
   - `ADMIN_INITIAL_PIN` = `7777`
4. **Deploy** tugmasini bosing — 1 daqiqada sizga **`https://ayub-club-pro.vercel.app`** kabi toza, doimiy va cheklovsiz havola beriladi!

## 3-qadam: Shaxsiy `.uz` domen ulash (ixtiyoriy)
1. `ahost.uz` yoki `eskiz.uz` dan masalan `ayubclub.uz` domenini oling.
2. Vercel → **Settings → Domains** bo‘limiga `ayubclub.uz` ni kiriting.
3. **Admin panel → QR-kod boshqaruvi → Doimiy Ochiq Domen** maydoniga `https://ayubclub.uz` ni saqlab, PNG/SVG QR-kodlarni yuklab oling.
