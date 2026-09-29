 // =========================================================================
        // Application State & Configurations
        // =========================================================================
        const vibrantColors = [
            '#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', 
            '#ec4899', '#3b82f6', '#14b8a6', '#84cc16', '#eab308',
            '#a855f7', '#6366f1', '#090518', '#059669', '#d97706'
        ];

        let options = [
            { id: '1', text: 'Pizza', color: vibrantColors[0] },
            { id: '2', text: 'Burgers', color: vibrantColors[1] },
            { id: '3', text: 'Sushi', color: vibrantColors[2] },
            { id: '4', text: 'Tacos', color: vibrantColors[3] },
            { id: '5', text: 'Pasta', color: vibrantColors[4] },
            { id: '6', text: 'Salad', color: vibrantColors[5] }
        ];

        let startAngle = 0; // Current rotation angle in radians
        let isSpinning = false;
        let spinDuration = 4000; // milliseconds
        let soundEnabled = true;
        let lastSegmentIndex = -1;

        // Canvas & UI Elements
        const canvas = document.getElementById('rouletteCanvas');
        const ctx = canvas.getContext('2d');
        const optionInput = document.getElementById('optionInput');
        const addOptionForm = document.getElementById('addOptionForm');
        const optionsList = document.getElementById('optionsList');
        const optionCount = document.getElementById('optionCount');
        const durationSlider = document.getElementById('durationSlider');
        const durationValue = document.getElementById('durationValue');
        const soundToggle = document.getElementById('soundToggle');
        const mainSpinBtn = document.getElementById('mainSpinBtn');
        const centerSpinBtn = document.getElementById('centerSpinBtn');
        const pointer = document.getElementById('pointer');
        
        // Winner Modal Elements
        const winnerModal = document.getElementById('winnerModal');
        const modalCard = document.getElementById('modalCard');
        const winnerText = document.getElementById('winnerText');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const spinAgainBtn = document.getElementById('spinAgainBtn');

        // Presets & Clear
        const presetYesNo = document.getElementById('presetYesNo');
        const presetFood = document.getElementById('presetFood');
        const presetNumbers = document.getElementById('presetNumbers');
        const clearAllBtn = document.getElementById('clearAllBtn');

        // =========================================================================
        // Web Audio API Synthesis for Ticking Effects
        // =========================================================================
        let audioCtx = null;

        function playTickSound() {
            if (!soundEnabled) return;
            try {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.04);

                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start();
                osc.stop(audioCtx.currentTime + 0.04);
            } catch (e) {
                // Audio fallback silence
            }
        }

        // =========================================================================
        // Canvas Setup & Rendering
        // =========================================================================
        function resizeCanvas() {
            const containerWidth = canvas.parentElement.clientWidth;
            const size = Math.min(containerWidth, 450);
            
            // Set high-DPI scaling
            const dpr = window.devicePixelRatio || 1;
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;
            
            ctx.scale(dpr, dpr);
            drawWheel();
        }

        function drawWheel() {
            const numOptions = options.length;
            const size = canvas.clientWidth;
            const center = size / 2;
            const outsideRadius = center - 12;
            const textRadius = outsideRadius * 0.65;
            const insideRadius = 35; // Center cap clearance

            ctx.clearRect(0, 0, size, size);

            if (numOptions === 0) {
                // Draw empty wheel placeholder
                ctx.beginPath();
                ctx.arc(center, center, outsideRadius, 0, 2 * Math.PI);
                ctx.fillStyle = '#1e293b';
                ctx.fill();
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 16px Poppins, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Please add options!', center, center);
                return;
            }

            const arc = (2 * Math.PI) / numOptions;

            for (let i = 0; i < numOptions; i++) {
                const angle = startAngle + i * arc;

                // Slice sector
                ctx.beginPath();
                ctx.arc(center, center, outsideRadius, angle, angle + arc, false);
                ctx.arc(center, center, insideRadius, angle + arc, angle, true);
                ctx.fillStyle = options[i].color;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.stroke();

                // Text Rendering
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 4;
                ctx.font = `bold ${numOptions > 12 ? '11px' : '14px'} Poppins, sans-serif`;

                // Translate to slice center and rotate for radial text
                const textAngle = angle + arc / 2;
                ctx.translate(
                    center + Math.cos(textAngle) * textRadius,
                    center + Math.sin(textAngle) * textRadius
                );
                ctx.rotate(textAngle + Math.PI); // Rotate text towards center

                // Truncate text if too long
                let text = options[i].text;
                if (text.length > 14) text = text.substring(0, 12) + '...';

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }

            // Outer metallic rim
            ctx.beginPath();
            ctx.arc(center, center, outsideRadius, 0, 2 * Math.PI);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#334155';
            ctx.stroke();
        }

        // =========================================================================
        // Physics-based Physics & Rotation Animation
        // =========================================================================
        let spinStartTime = null;
        let startRotationAngle = 0;
        let totalTargetRotation = 0;

        // Custom cubic ease-out function for realistic slowdown
        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function triggerPointerTick() {
            pointer.classList.remove('pointer-tick');
            // Trigger reflow to restart animation
            void pointer.offsetWidth;
            pointer.classList.add('pointer-tick');
            playTickSound();
        }

        function animateSpin(timestamp) {
            if (!spinStartTime) spinStartTime = timestamp;
            const elapsed = timestamp - spinStartTime;
            const progress = Math.min(elapsed / spinDuration, 1);

            // Calculate current angle based on easing curve
            const easedProgress = easeOutCubic(progress);
            startAngle = startRotationAngle + easedProgress * totalTargetRotation;
            
            // Normalize startAngle to keep it within [0, 2*PI]
            const normalizedAngle = startAngle % (2 * Math.PI);

            // Tick sound & pointer animation logic based on segment boundary traversal
            if (options.length > 0) {
                const arc = (2 * Math.PI) / options.length;
                // Pointer is fixed at top center (angle: 3 * PI / 2)
                const pointerAngle = (3 * Math.PI / 2);
                
                // Calculate which slice index is currently under pointer
                let currentSlice = Math.floor(((2 * Math.PI) - (normalizedAngle % (2 * Math.PI)) + pointerAngle) % (2 * Math.PI) / arc);
                currentSlice = (currentSlice + options.length) % options.length;

                if (currentSlice !== lastSegmentIndex) {
                    lastSegmentIndex = currentSlice;
                    triggerPointerTick();
                }
            }

            drawWheel();

            if (progress < 1) {
                requestAnimationFrame(animateSpin);
            } else {
                isSpinning = false;
                toggleSpinButtons(true);
                determineWinner();
            }
        }

        function spin() {
            if (isSpinning || options.length === 0) return;

            // Initialize web audio on user gesture
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            isSpinning = true;
            toggleSpinButtons(false);

            spinStartTime = null;
            startRotationAngle = startAngle;
            
            // Minimum rotations plus random slice placement (5 to 8 full turns)
            const extraRotations = (5 + Math.random() * 3) * 2 * Math.PI;
            totalTargetRotation = extraRotations;

            requestAnimationFrame(animateSpin);
        }

        function determineWinner() {
            const numOptions = options.length;
            const arc = (2 * Math.PI) / numOptions;
            
            // Pointer is located at top (3 * Math.PI / 2)
            const pointerAngle = 3 * Math.PI / 2;
            const normalizedAngle = startAngle % (2 * Math.PI);
            
            // Calculate slice index aligned with pointer
            let winnerIndex = Math.floor(((2 * Math.PI) - (normalizedAngle % (2 * Math.PI)) + pointerAngle) % (2 * Math.PI) / arc);
            winnerIndex = (winnerIndex + numOptions) % numOptions;

            const winner = options[winnerIndex];
            showWinnerModal(winner.text);
        }

        function toggleSpinButtons(enabled) {
            mainSpinBtn.disabled = !enabled;
            centerSpinBtn.disabled = !enabled;
            if (enabled) {
                mainSpinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                centerSpinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                mainSpinBtn.classList.add('opacity-50', 'cursor-not-allowed');
                centerSpinBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

        // =========================================================================
        // Winner Modal & Confetti Effects
        // =========================================================================
        function showWinnerModal(text) {
            winnerText.innerText = text;
            winnerModal.classList.remove('hidden');
            
            // Trigger popup scale animation
            setTimeout(() => {
                modalCard.classList.remove('scale-95', 'opacity-0');
                modalCard.classList.add('scale-100', 'opacity-100');
            }, 10);

            // Fire Celebration Confetti
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }

        function hideWinnerModal() {
            modalCard.classList.remove('scale-100', 'opacity-100');
            modalCard.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                winnerModal.classList.add('hidden');
            }, 300);
        }

        // =========================================================================
        // Options List Management & UI Rendering
        // =========================================================================
        function renderOptionsList() {
            optionsList.innerHTML = '';
            optionCount.textContent = `${options.length} choice${options.length !== 1 ? 's' : ''}`;

            options.forEach((opt, idx) => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 text-sm group hover:border-slate-700 transition-colors';
                
                item.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden pr-2">
                        <span class="w-3.5 h-3.5 rounded-full flex-shrink-0" style="background-color: ${opt.color}"></span>
                        <span class="text-slate-200 truncate font-medium">${escapeHTML(opt.text)}</span>
                    </div>
                    <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onclick="deleteOption('${opt.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors" title="Delete choice">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `;
                optionsList.appendChild(item);
            });

            drawWheel();
        }

        function addOption(text) {
            const trimmed = text.trim();
            if (!trimmed) return;

            const color = vibrantColors[options.length % vibrantColors.length];
            options.push({
                id: Date.now().toString(),
                text: trimmed,
                color: color
            });

            renderOptionsList();
        }

        window.deleteOption = function(id) {
            if (isSpinning) return;
            options = options.filter(opt => opt.id !== id);
            renderOptionsList();
        };

        function escapeHTML(str) {
            return str.replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }

        // Preset Loaders
        function loadPreset(presetArray) {
            if (isSpinning) return;
            options = presetArray.map((text, i) => ({
                id: Date.now().toString() + i,
                text: text,
                color: vibrantColors[i % vibrantColors.length]
            }));
            renderOptionsList();
        }

        // =========================================================================
        // Event Listeners & Initialization
        // =========================================================================
        addOptionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (optionInput.value) {
                addOption(optionInput.value);
                optionInput.value = '';
            }
        });

        mainSpinBtn.addEventListener('click', spin);
        centerSpinBtn.addEventListener('click', spin);

        durationSlider.addEventListener('input', (e) => {
            spinDuration = parseFloat(e.target.value) * 1000;
            durationValue.textContent = `${e.target.value}s`;
        });

        soundToggle.addEventListener('change', (e) => {
            soundEnabled = e.target.checked;
        });

        closeModalBtn.addEventListener('click', hideWinnerModal);
        spinAgainBtn.addEventListener('click', () => {
            hideWinnerModal();
            setTimeout(spin, 300);
        });

        // Presets Listeners
        presetYesNo.addEventListener('click', () => loadPreset(['Yes', 'No', 'Maybe']));
        presetFood.addEventListener('click', () => loadPreset(['Pizza', 'Sushi', 'Burgers', 'Tacos', 'Salad', 'Ramen', 'Pasta']));
        presetNumbers.addEventListener('click', () => loadPreset(['1', '2', '3', '4', '5', '6']));
        clearAllBtn.addEventListener('click', () => loadPreset([]));