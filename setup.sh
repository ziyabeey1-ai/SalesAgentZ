#!/bin/bash

echo "=========================================="
echo "   AI SALES AGENT - MAC/LINUX KURULUM"
echo "=========================================="
echo ""

# 1. Node.js Kontrolü
echo "[1/4] Node.js kontrol ediliyor..."
if ! command -v node &> /dev/null; then
    echo "HATA: Node.js yüklü değil! Lütfen https://nodejs.org adresinden yükleyin."
    exit 1
fi
echo "Node.js bulundu: $(node -v)"
echo ""

# 2. Bağımlılıkları Yükle
echo "[2/4] Gerekli kütüphaneler yükleniyor..."
npm install
if [ $? -ne 0 ]; then
    echo "HATA: Yükleme sırasında bir sorun oluştu."
    exit 1
fi
echo "Kütüphaneler başarıyla yüklendi."
echo ""

# 3. .env Dosyası Kontrolü
echo "[3/4] API Anahtarı Yapılandırması..."
if [ ! -f .env ]; then
    echo "API_KEY=BURAYA_KENDI_GEMINI_API_ANAHTARINIZI_YAZIN" > .env
    echo ".env dosyası oluşturuldu."
    echo "Lütfen .env dosyasını açıp API anahtarınızı yapıştırın."
else
    echo ".env dosyası zaten mevcut."
fi
echo ""

# 4. Uygulamayı Başlat
echo "[4/4] Uygulama başlatılıyor..."
echo "Tarayıcınız otomatik açılacak. Durdurmak için Ctrl+C tuşlarına basın."
echo ""

# Mac'te tarayıcıyı açmaya çalış (Vite genellikle bunu yapar ama garanti olsun)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000" 2>/dev/null
fi

npm run dev
