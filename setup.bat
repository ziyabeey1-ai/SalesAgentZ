@echo off
echo ==========================================
echo   AI SALES AGENT - OTOMATIK KURULUM
echo ==========================================
echo.

echo [1/4] Node.js kontrol ediliyor...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Node.js yuklu degil! Lutfen https://nodejs.org adresinden yukleyin.
    pause
    exit
)
echo Node.js bulundu.
echo.

echo [2/4] Gerekli kutuphaneler yukleniyor (Bu islem internet hizina gore 1-2 dakika surebilir)...
call npm install
if %errorlevel% neq 0 (
    echo HATA: Yukleme sirasinda bir sorun olustu.
    pause
    exit
)
echo Kutuphaneler basariyla yuklendi.
echo.

echo [3/4] API Anahtari Yapilandirmasi...
if not exist .env (
    echo .env dosyasi olusturuluyor...
    echo API_KEY=BURAYA_KENDI_GEMINI_API_ANAHTARINIZI_YAZIN > .env
    echo Lutfen olusturulan .env dosyasini acip API anahtarinizi yapistirin.
) else (
    echo .env dosyasi zaten mevcut.
)
echo.

echo [4/4] Uygulama baslatiliyor...
echo Tarayiciniz otomatik acilacak. Durdurmak icin bu pencereyi kapatin.
echo.
call npm run dev
