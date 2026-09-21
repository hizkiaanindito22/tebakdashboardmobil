// ===================================================
// GAME STATE & LOGIC SYSTEM
// ===================================================

let database = [];
let currentMode = ''; 
let answerMode = ''; 
let selectedBrand = 'ALL';
let score = 0;
let timeLeft = 60;
let timerInterval;
let currentCar = null;
let playedCars = [];
let isProcessingAnswer = false;

async function fetchDatabase() {
    const loadingText = document.querySelector('#screen-loading p');
    const loadingIcon = document.querySelector('#screen-loading i');

    // Cek apakah URL masih default
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'PASTE_SUPABASE_URL_DISINI' || !SUPABASE_URL) {
        loadingIcon.className = "fas fa-exclamation-triangle text-5xl text-yellow-500 mb-4";
        loadingText.innerHTML = "Konfigurasi API Belum Diisi!<br><span class='text-sm text-zinc-500'>Buka file config.js dan masukkan URL & Key Supabase Anda.</span>";
        loadingText.classList.add('text-center');
        return;
    }

    try {
        loadingText.innerHTML = "Menghubungi Supabase...";

        const response = await fetch(`${SUPABASE_URL}/rest/v1/cars?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            let errorDetail = '';
            try {
                const errData = await response.json();
                errorDetail = errData.message || errData.hint || errData.details;
            } catch(e) {
                errorDetail = `HTTP Error ${response.status}`;
            }
            throw new Error(errorDetail || "Koneksi ditolak oleh Supabase.");
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
             throw new Error("Tabel 'cars' sudah terhubung, tapi isinya masih 0. Masukkan minimal 1 data (Insert Row).");
        }

        // Format data ke bentuk yang dipahami game (Mendukung brand_cars / accepted_answer)
        database = data.map(car => {
            const rawAnswers = car.accepted_answer || car.accepted_answers || '';
            const answers = rawAnswers ? rawAnswers.split(',').map(a => a.trim().toLowerCase()) : [car.full_name.toLowerCase()];
            const brand = car.brand_cars ? car.brand_cars.trim().toUpperCase() : (car.brand ? car.brand.trim().toUpperCase() : 'LAINNYA');
            return {
                id: car.id,
                fullName: car.full_name,
                img: car.image_url,
                acceptedAnswers: answers,
                brand: brand
            };
        });
        
        // Database sukses ditarik! Lanjut ke menu utama
        switchScreen('screen-menu');
        
    } catch (error) {
        console.error("Supabase Error:", error);
        loadingIcon.className = "fas fa-times-circle text-5xl text-red-500 mb-4";
        loadingText.innerHTML = `<span class='text-red-400 font-bold'>Database Error</span><br><span class='text-xs text-zinc-400 mt-2 block bg-dark-700 p-2 rounded'>${error.message}</span>`;
        loadingText.classList.add('text-center');
    }
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    setTimeout(() => {
        document.getElementById(screenId).classList.add('active');
    }, 50);
}

function selectGameMode(mode) {
    currentMode = mode;
    populateBrandList();
    switchScreen('screen-brand');
}

function populateBrandList() {
    const container = document.getElementById('brand-list');
    if (!container) return;
    container.innerHTML = '';

    // Hitung jumlah mobil per brand
    const brandCounts = {};
    database.forEach(car => {
        const b = car.brand || 'LAINNYA';
        brandCounts[b] = (brandCounts[b] || 0) + 1;
    });

    // Tombol "Semua Brand"
    const allBtn = document.createElement('button');
    allBtn.className = 'w-full p-4 bg-brand-600 hover:bg-brand-500 rounded-2xl font-bold transition-all text-left flex justify-between items-center text-white border border-brand-400/30 col-span-1 md:col-span-2 shadow-lg mb-2';
    allBtn.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas fa-layer-group text-xl text-brand-200"></i>
            <div>
                <span class="block text-base font-extrabold">Semua Brand (All)</span>
                <span class="text-xs text-brand-200 font-normal">Mainkan semua koleksi dashboard</span>
            </div>
        </div>
        <span class="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">${database.length} Mobil</span>
    `;
    allBtn.onclick = () => chooseBrand('ALL');
    container.appendChild(allBtn);

    // Tombol per brand
    Object.keys(brandCounts).sort().forEach(brand => {
        const btn = document.createElement('button');
        btn.className = 'p-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-brand-500 rounded-2xl transition-all flex justify-between items-center text-zinc-100 font-bold shadow-sm';
        btn.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-car text-brand-500 text-sm"></i>
                <span class="capitalize tracking-wide">${brand}</span>
            </div>
            <span class="bg-dark-900 text-zinc-400 px-2.5 py-1 rounded-full text-xs font-bold">${brandCounts[brand]}</span>
        `;
        btn.onclick = () => chooseBrand(brand);
        container.appendChild(btn);
    });
}

function chooseBrand(brand) {
    selectedBrand = brand;
    switchScreen('screen-answer-mode');
}

function startGame(aMode) {
    answerMode = aMode;
    switchScreen('screen-game');
    
    // Atur Visibilitas Input
    document.getElementById('input-multiple').classList.add('hidden');
    document.getElementById('input-typing').classList.add('hidden');
    
    if (answerMode === 'multiple') {
        document.getElementById('input-multiple').classList.remove('hidden');
    } else {
        document.getElementById('input-typing').classList.remove('hidden');
        setTimeout(() => document.getElementById('type-input').focus(), 300);
    }

    // Reset Game State
    score = 0;
    playedCars = [];
    isProcessingAnswer = false;
    document.getElementById('score-display').innerText = score;

    // Timer Setup
    if (currentMode === 'challenge') {
        timeLeft = 60;
        document.getElementById('timer-container').classList.remove('hidden');
        document.getElementById('time-left').innerText = timeLeft;
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        document.getElementById('timer-container').classList.add('hidden');
    }

    loadNextCar();
}

function loadNextCar() {
    isProcessingAnswer = false;
    
    // Reset UI State
    if (answerMode === 'typing') {
        document.getElementById('type-input').value = '';
        document.getElementById('type-input').classList.remove('shake-animation', 'correct-animation');
    }
    
    const toast = document.getElementById('feedback-toast');
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');

    // Filter database berdasarkan brand yang dipilih
    let pool = database;
    if (selectedBrand !== 'ALL') {
        pool = database.filter(car => car.brand === selectedBrand);
    }
    if (pool.length === 0) pool = database;

    let availableCars = pool.filter(car => !playedCars.includes(car.id));
    if (availableCars.length === 0) {
        playedCars = []; // Reset jika mobil brand tersebut sudah dimainkan semua
        availableCars = [...pool];
    }

    currentCar = availableCars[Math.floor(Math.random() * availableCars.length)];
    playedCars.push(currentCar.id);

    // Handle Gambar
    const imgEl = document.getElementById('dashboard-image');
    const loaderEl = document.getElementById('image-loader');
    
    imgEl.classList.remove('opacity-100');
    imgEl.classList.add('opacity-0');
    loaderEl.classList.remove('hidden');
    
    imgEl.onload = () => {
        loaderEl.classList.add('hidden');
        imgEl.classList.remove('opacity-0');
        imgEl.classList.add('opacity-100');
    };
    imgEl.src = currentCar.img;

    if (answerMode === 'multiple') {
        generateMultipleChoice(currentCar);
    }
}

function generateMultipleChoice(correctCar) {
    const container = document.getElementById('input-multiple');
    container.innerHTML = '';

    let wrongCars = database.filter(c => c.id !== correctCar.id);
    wrongCars = wrongCars.sort(() => 0.5 - Math.random()).slice(0, 3);
    let options = [...wrongCars, correctCar].sort(() => 0.5 - Math.random());

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'py-4 bg-dark-700 hover:bg-dark-600 rounded-2xl font-bold transition-all border border-dark-600 shadow-sm text-zinc-100';
        btn.innerText = option.fullName;
        btn.onclick = () => {
            if(isProcessingAnswer) return;
            handleChoiceClick(btn, option.id === correctCar.id, option.fullName);
        };
        container.appendChild(btn);
    });
}

function checkSmartAnswer(rawInput, car) {
    if (!rawInput || !car) return false;
    const input = rawInput.trim().toLowerCase();
    if (!input) return false;

    const commonBrands = [
        'toyota', 'honda', 'suzuki', 'daihatsu', 'mitsubishi', 'nissan', 'hyundai', 
        'kia', 'mazda', 'isuzu', 'wuling', 'dfsk', 'chery', 'byd', 'mg', 'bmw', 
        'mercedes', 'mercedes benz', 'benz', 'audi', 'volkswagen', 'vw', 'porsche', 
        'ferrari', 'lamborghini', 'ford', 'chevrolet', 'jeep', 'dodge', 'subaru', 'lexus'
    ];

    const genericWords = [
        'gen', 'generation', 'facelift', 'all', 'new', 'series', 'seri', 'type', 'spec', 'v', 'q', 'g', 'e', 'x'
    ];

    // Pembersihan string
    const clean = str => str.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const cleanInput = clean(input);
    const cleanFullName = clean(car.fullName.toLowerCase());

    if (!cleanInput) return false;

    // 1. Jangan benarkan jika HANYA menuliskan nama merek atau kata generik saja
    if (commonBrands.includes(cleanInput) || genericWords.includes(cleanInput)) {
        return false;
    }

    // 2. Cek apakah ada di acceptedAnswers dari database
    if (car.acceptedAnswers && Array.isArray(car.acceptedAnswers)) {
        if (car.acceptedAnswers.some(ans => clean(ans.toLowerCase()) === cleanInput)) {
            return true;
        }
    }

    // 3. Jika input sama persis dengan nama lengkap
    if (cleanInput === cleanFullName) return true;

    // 4. Tokenisasi kata untuk pencocokan kata UTUH (mencegah potongan seperti "ava")
    const fullNameWords = cleanFullName.split(' ');
    const inputWords = cleanInput.split(' ');

    // Ambil kata-kata model utama (bukan merek, kata generik, atau angka terpisah)
    const modelWords = fullNameWords.filter(w => 
        !commonBrands.includes(w) && 
        !genericWords.includes(w) && 
        isNaN(w) &&
        w.length >= 2
    );

    // Cek apakah ada kata model yang cocok sebagai KATA UTUH dalam input
    for (let modelWord of modelWords) {
        if (inputWords.includes(modelWord)) {
            return true;
        }
    }

    // 5. Cek jika input adalah frasa utuh dalam nama lengkap (harus mengandung kata model utuh)
    if (cleanFullName.includes(cleanInput)) {
        const hasModelWord = modelWords.some(mw => inputWords.includes(mw));
        if (hasModelWord) {
            return true;
        }
    }

    return false;
}

function submitTypedAnswer() {
    if (isProcessingAnswer) return;
    const inputEl = document.getElementById('type-input');
    const inputVal = inputEl.value.trim();
    
    if (inputVal === '') return;

    const isCorrect = checkSmartAnswer(inputVal, currentCar);
    
    isProcessingAnswer = true;
    inputEl.classList.remove('shake-animation', 'correct-animation');
    
    void inputEl.offsetWidth; 

    if(isCorrect) {
        inputEl.classList.add('correct-animation');
    } else {
        inputEl.classList.add('shake-animation');
    }
    
    processAnswer(isCorrect, currentCar.fullName);
}

function handleChoiceClick(btnElement, isCorrect, correctText) {
    isProcessingAnswer = true;
    
    if (isCorrect) {
        btnElement.classList.replace('bg-dark-700', 'bg-emerald-600');
        btnElement.classList.replace('border-dark-600', 'border-emerald-500');
    } else {
        btnElement.classList.add('shake-animation', 'bg-red-900/30');
        
        const allBtns = document.getElementById('input-multiple').querySelectorAll('button');
        allBtns.forEach(b => {
            if (b.innerText === currentCar.fullName) {
                b.classList.replace('bg-dark-700', 'bg-emerald-600/50');
                b.classList.add('border-emerald-500');
            }
        });
    }
    processAnswer(isCorrect, currentCar.fullName);
}

function processAnswer(isCorrect, correctText) {
    const toast = document.getElementById('feedback-toast');
    toast.classList.remove('bg-emerald-500', 'bg-red-500');

    if (isCorrect) {
        score += 10;
        document.getElementById('score-display').innerText = score;
        toast.innerText = "Benar! +10";
        toast.classList.add('bg-emerald-500', 'opacity-100');
        setTimeout(loadNextCar, 1000);
    } else {
        if (currentMode === 'challenge') {
            score = Math.max(0, score - 5);
            document.getElementById('score-display').innerText = score;
        }
        toast.innerText = `Salah! Itu adalah ${correctText}`;
        toast.classList.add('bg-red-500', 'opacity-100');
        setTimeout(loadNextCar, 2000);
    }
}

function updateTimer() {
    timeLeft--;
    const timeDisplay = document.getElementById('time-left');
    timeDisplay.innerText = timeLeft;
    
    if(timeLeft <= 10) {
        timeDisplay.parentElement.classList.add('animate-pulse');
    } else {
        timeDisplay.parentElement.classList.remove('animate-pulse');
    }
    
    if (timeLeft <= 0) {
        endGame();
    }
}

function endGame() {
    clearInterval(timerInterval);
    document.getElementById('final-score').innerText = score;
    switchScreen('screen-result');
}

function quitGame() {
    clearInterval(timerInterval);
    switchScreen('screen-menu');
}

document.addEventListener('DOMContentLoaded', () => {
    const typeInput = document.getElementById('type-input');
    if (typeInput) {
        typeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') submitTypedAnswer();
        });
    }
    fetchDatabase();
});