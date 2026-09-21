// Variable State Game
let database = [];
let filteredDatabase = [];
let selectedBrand = 'ALL';
let currentMode = ''; 
let answerMode = ''; 
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let currentCar = null;
let playedCars = [];
let isProcessingAnswer = false;

async function fetchDatabase() {
    try {
        if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined' || SUPABASE_URL.includes('PASTE_SUPABASE')) {
            throw new Error("Konfigurasi Supabase belum diisi di file config.js");
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/cars?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Error status: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            throw new Error("Tabel 'cars' di Supabase masih kosong.");
        }

        database = data.map(car => {
            const acceptedStr = car.accepted_answer || car.accepted_answers || '';
            const acceptedList = acceptedStr ? acceptedStr.split(',').map(a => a.trim().toLowerCase()) : [];
            
            // Ekstrak nama brand (Gunakan kolom brand_cars atau ambil kata pertama)
            let brandName = car.brand_cars ? car.brand_cars.trim().toUpperCase() : car.full_name.split(' ')[0].toUpperCase();

            return {
                id: car.id,
                fullName: car.full_name,
                brand: brandName,
                img: car.image_url,
                acceptedAnswers: acceptedList
            };
        });

        console.log("Database Supabase Berhasil Ditarik:", database);
        populateBrandList();
        switchScreen('screen-menu');

    } catch (error) {
        console.error("Gagal terhubung ke Supabase:", error);
        
        const spinner = document.getElementById('loading-spinner');
        const detail = document.getElementById('loading-detail');
        const status = document.getElementById('loading-status');

        if (spinner) {
            spinner.className = "fas fa-times-circle text-4xl text-red-500 mb-2";
        }
        if (status) {
            status.innerHTML = `<p class="text-red-400 font-bold text-lg">Koneksi Database Gagal</p>`;
        }
        if (detail) {
            detail.innerHTML = `<p class="text-zinc-400 text-xs mt-2 bg-dark-800 p-3 rounded-lg border border-dark-700 max-w-xs font-mono">${error.message}</p>`;
        }
    }
}

function populateBrandList() {
    const container = document.getElementById('brand-list');
    if (!container) return;

    container.innerHTML = '';

    // Hitung jumlah total mobil per brand
    const brandCounts = {};
    database.forEach(c => {
        brandCounts[c.brand] = (brandCounts[c.brand] || 0) + 1;
    });

    const uniqueBrands = Object.keys(brandCounts).sort();

    // Opsi: Semua Brand
    const allBtn = document.createElement('button');
    allBtn.className = 'flex justify-between items-center p-4 bg-dark-700 hover:bg-dark-600 rounded-2xl border border-dark-600 text-left transition-all';
    allBtn.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-brand-500/20 text-brand-500 rounded-xl flex items-center justify-center font-bold">
                <i class="fas fa-globe"></i>
            </div>
            <div>
                <h4 class="font-bold text-white">Semua Brand</h4>
                <p class="text-xs text-zinc-400">Mainkan semua koleksi mobil</p>
            </div>
        </div>
        <span class="text-xs bg-dark-900 px-2.5 py-1 rounded-lg text-zinc-400 font-bold">${database.length}</span>
    `;
    allBtn.onclick = () => selectBrand('ALL');
    container.appendChild(allBtn);

    // Render masing-masing brand
    uniqueBrands.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'flex justify-between items-center p-4 bg-dark-700 hover:bg-dark-600 rounded-2xl border border-dark-600 text-left transition-all';
        btn.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-dark-900 text-zinc-300 rounded-xl flex items-center justify-center font-bold uppercase text-xs">
                    ${b.substring(0, 3)}
                </div>
                <div>
                    <h4 class="font-bold text-white">${b}</h4>
                    <p class="text-xs text-zinc-400">Koleksi khusus ${b}</p>
                </div>
            </div>
            <span class="text-xs bg-dark-900 px-2.5 py-1 rounded-lg text-zinc-400 font-bold">${brandCounts[b]}</span>
        `;
        btn.onclick = () => selectBrand(b);
        container.appendChild(btn);
    });
}

function selectBrand(brandName) {
    selectedBrand = brandName;
    if (selectedBrand === 'ALL') {
        filteredDatabase = [...database];
    } else {
        filteredDatabase = database.filter(c => c.brand === selectedBrand);
    }
    switchScreen('screen-answer-mode');
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
}

function selectGameMode(mode) {
    currentMode = mode;
    switchScreen('screen-brand');
}

function startGame(aMode) {
    answerMode = aMode;
    score = 0;
    playedCars = [];
    isProcessingAnswer = false;

    document.getElementById('score-display').innerText = score;

    document.getElementById('input-multiple').classList.add('hidden');
    document.getElementById('input-typing').classList.add('hidden');

    if (answerMode === 'multiple') {
        document.getElementById('input-multiple').classList.remove('hidden');
    } else {
        document.getElementById('input-typing').classList.remove('hidden');
    }

    if (currentMode === 'challenge') {
        timeLeft = 60;
        document.getElementById('timer-container').classList.remove('hidden');
        document.getElementById('time-left').innerText = timeLeft;
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        document.getElementById('timer-container').classList.add('hidden');
    }

    switchScreen('screen-game');
    loadNextCar();
}

function loadNextCar() {
    isProcessingAnswer = false;

    let availableCars = filteredDatabase.filter(car => !playedCars.includes(car.id));
    if (availableCars.length === 0) {
        playedCars = [];
        availableCars = [...filteredDatabase];
    }

    currentCar = availableCars[Math.floor(Math.random() * availableCars.length)];
    playedCars.push(currentCar.id);

    const imgEl = document.getElementById('dashboard-image');
    const loader = document.getElementById('image-loader');
    
    loader.style.display = 'flex';
    imgEl.classList.add('opacity-0');

    imgEl.src = currentCar.img;
    imgEl.onload = () => {
        loader.style.display = 'none';
        imgEl.classList.remove('opacity-0');
    };

    if (answerMode === 'multiple') {
        generateMultipleChoice(currentCar);
    } else {
        const typeInput = document.getElementById('type-input');
        typeInput.value = '';
        typeInput.focus();
    }
}

function generateMultipleChoice(correctCar) {
    const container = document.getElementById('input-multiple');
    container.innerHTML = '';

    const selectedOptions = [correctCar];

    // 1. Opsi tambahan dari brand yang SAMA (jika ada)
    const sameBrandCars = database.filter(c => c.brand === correctCar.brand && c.id !== correctCar.id);
    if (sameBrandCars.length > 0) {
        const randomSameBrand = sameBrandCars[Math.floor(Math.random() * sameBrandCars.length)];
        selectedOptions.push(randomSameBrand);
    }

    // 2. Opsi dari brand LAIN
    const diffBrandCars = database.filter(c => c.brand !== correctCar.brand && !selectedOptions.some(so => so.id === c.id));
    const shuffledDiff = [...diffBrandCars].sort(() => 0.5 - Math.random());
    
    while (selectedOptions.length < 4 && shuffledDiff.length > 0) {
        selectedOptions.push(shuffledDiff.pop());
    }

    // Cadangan jika opsi belum mencapai 4
    if (selectedOptions.length < 4) {
        const remainingCars = database.filter(c => !selectedOptions.some(so => so.id === c.id))
                                     .sort(() => 0.5 - Math.random());
        while (selectedOptions.length < 4 && remainingCars.length > 0) {
            selectedOptions.push(remainingCars.pop());
        }
    }

    const options = selectedOptions.sort(() => 0.5 - Math.random());

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

function handleChoiceClick(btnElement, isCorrect, chosenText) {
    isProcessingAnswer = true;
    if (isCorrect) {
        btnElement.classList.add('correct-animation');
        showToast("Benar! (+10)", true);
        score += 10;
    } else {
        btnElement.classList.add('shake-animation');
        showToast(`Salah! Itu ${currentCar.fullName}`, false);
        if (currentMode === 'challenge') score = Math.max(0, score - 5);
    }
    document.getElementById('score-display').innerText = score;

    setTimeout(() => {
        loadNextCar();
    }, 1200);
}

function submitTypedAnswer() {
    if (isProcessingAnswer) return;
    
    const inputEl = document.getElementById('type-input');
    const rawInput = inputEl.value;
    
    if (!rawInput || rawInput.trim() === '') return;

    isProcessingAnswer = true;
    const isCorrect = checkSmartAnswer(rawInput, currentCar);

    if (isCorrect) {
        showToast("Benar! (+10)", true);
        score += 10;
    } else {
        showToast(`Salah! Itu ${currentCar.fullName}`, false);
        if (currentMode === 'challenge') score = Math.max(0, score - 5);
    }

    document.getElementById('score-display').innerText = score;

    setTimeout(() => {
        loadNextCar();
    }, 1500);
}

function checkSmartAnswer(rawInput, car) {
    const cleanInput = rawInput.trim().toLowerCase();
    
    // 1. Cek dari acceptedAnswers bawaan database Supabase
    if (car.acceptedAnswers && car.acceptedAnswers.length > 0) {
        if (car.acceptedAnswers.includes(cleanInput)) return true;
    }

    // 2. Cek kata utuh (Exact Word Match)
    const cleanFullName = car.fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cleanInputWord = cleanInput.replace(/[^a-z0-9\s]/g, '');

    if (cleanInputWord.length < 3) return false;

    // Abaikan jika tebakan hanya berupa nama merek mobil saja
    const brandLower = car.brand ? car.brand.toLowerCase() : '';
    if (cleanInputWord === brandLower) return false;

    // Pengecekan dengan batasan kata utuh (Word boundary)
    const escapedInput = cleanInputWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`\\b${escapedInput}\\b`, 'i');

    return wordBoundaryRegex.test(cleanFullName);
}

function showToast(message, isCorrect) {
    const toast = document.getElementById('feedback-toast');
    toast.innerText = message;
    
    if (isCorrect) {
        toast.className = "absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-2.5 rounded-2xl font-extrabold text-white z-30 pointer-events-none shadow-xl bg-emerald-600 transition-all duration-300 opacity-100 scale-100";
    } else {
        toast.className = "absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-2.5 rounded-2xl font-extrabold text-white z-30 pointer-events-none shadow-xl bg-red-600 transition-all duration-300 opacity-100 scale-100";
    }

    setTimeout(() => {
        toast.classList.add('opacity-0', 'scale-95');
    }, 1000);
}

function updateTimer() {
    timeLeft--;
    document.getElementById('time-left').innerText = timeLeft;

    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        showResult();
    }
}

function showResult() {
    document.getElementById('final-score').innerText = score;
    switchScreen('screen-result');
}

function quitGame() {
    clearInterval(timerInterval);
    switchScreen('screen-menu');
}

// Event listener enter key untuk mode ketik
document.addEventListener('DOMContentLoaded', () => {
    fetchDatabase();

    const inputField = document.getElementById('type-input');
    if (inputField) {
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitTypedAnswer();
            }
        });
    }
});
