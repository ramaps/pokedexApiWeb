class Pokedex {
            constructor() {
                this.currentPokemonId = 1;
                this.maxPokemonId = 1025;
                this.qrScanner = null;
                this.isScanning = false;
                this.currentCamera = "environment"; 
                this.cameraLocked = false; 

                this.HISTORY_STORAGE_KEY = 'pokedex_scanned_history';
                this.scannedHistory = this.loadHistory(); 
                
                this.initializeEventListeners();
                this.loadPokemon(this.currentPokemonId);
            }

            initializeEventListeners() {
                // ... (Event Listeners existentes) ...
                document.getElementById('searchBtn').addEventListener('click', () => this.searchPokemon());
                document.getElementById('qrBtn').addEventListener('click', () => this.openQRScanner());
                document.getElementById('prevBtn').addEventListener('click', () => this.previousPokemon());
                document.getElementById('nextBtn').addEventListener('click', () => this.nextPokemon());
                document.getElementById('randomBtn').addEventListener('click', () => this.loadRandomPokemon());
                
                // Listeners de Historial
                document.getElementById('historyBtn').addEventListener('click', () => this.openHistoryScreen());
                document.getElementById('closeHistoryModal').addEventListener('click', () => document.getElementById('historyModal').style.display = 'none');
                
                // *** NUEVOS LISTENERS PARA IMPORTAR/EXPORTAR ***
                document.getElementById('exportHistoryBtn').addEventListener('click', () => this.exportHistoryToTxt());
                document.getElementById('importFile').addEventListener('change', (e) => this.importHistoryFromTxt(e.target.files[0]));
                // ... (Resto de Listeners de la cámara) ...
                
                document.getElementById('closeModal').addEventListener('click', () => this.closeQRScanner()); 
                document.getElementById('retryCamera').addEventListener('click', () => this.openQRScanner());
                document.getElementById('frontCamera').addEventListener('click', () => this.switchCamera('user'));
                document.getElementById('rearCamera').addEventListener('click', () => this.switchCamera('environment'));
                
                document.getElementById('pokemonInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.searchPokemon();
                });

                document.getElementById('qrModal').addEventListener('click', (e) => {
                    if (e.target === document.getElementById('qrModal')) {
                        this.closeQRScanner();
                    }
                });

                window.addEventListener('popstate', (e) => {
                    if (this.isScanning) {
                        this.closeQRScanner(false); 
                    }
                });
            }
            
            // --- NUEVAS FUNCIONES DE EXPORTAR / IMPORTAR TXT ---

            exportHistoryToTxt() {
                // Convierte las claves del historial (los IDs) a una lista separada por comas
                const historyIds = Object.keys(this.scannedHistory).join(',');
                
                if (!historyIds) {
                    alert('No hay Pokémon escaneados para exportar.');
                    return;
                }
                
                // Crea un objeto Blob (similar a un archivo)
                const blob = new Blob([historyIds], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                // Crea un enlace temporal para forzar la descarga
                const a = document.createElement('a');
                a.href = url;
                // El navegador le preguntará al usuario dónde guardar este archivo
                a.download = `pokedex_history_${new Date().toISOString().slice(0, 10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                alert('Historial exportado con éxito. ¡Busca el archivo en tu carpeta de descargas!');
            }

            importHistoryFromTxt(file) {
                if (!file) {
                    alert('Por favor, selecciona un archivo .txt de historial.');
                    return;
                }

                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const content = e.target.result;
                        // Espera una lista de números separados por comas
                        const ids = content.split(',')
                                           .map(id => parseInt(id.trim()))
                                           .filter(id => !isNaN(id) && id >= 1 && id <= this.maxPokemonId);
                        
                        if (ids.length === 0) {
                            alert('El archivo no contiene IDs de Pokémon válidos.');
                            return;
                        }

                        // Fusiona el historial existente con el nuevo
                        ids.forEach(id => {
                            this.scannedHistory[String(id)] = true;
                        });

                        this.saveHistory();
                        this.displayHistory();
                        
                        alert(`Historial importado y fusionado con éxito. ${ids.length} Pokémon encontrados.`);

                    } catch (error) {
                        console.error('Error al leer el archivo de historial:', error);
                        alert('Hubo un error al procesar el archivo. Asegúrate de que es un .txt válido.');
                    }
                };

                // Inicia la lectura del archivo seleccionado
                reader.readAsText(file);
                
                // Limpia el input para que pueda volver a importar el mismo archivo
                document.getElementById('importFile').value = null; 
            }

            // --- Funciones de Historial Local (JSON) ---

            loadHistory() {
                try {
                    const historyJson = localStorage.getItem(this.HISTORY_STORAGE_KEY);
                    return historyJson ? JSON.parse(historyJson) : {}; 
                } catch (e) {
                    console.error("Error al cargar el historial:", e);
                    return {};
                }
            }

            saveHistory() {
                try {
                    localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(this.scannedHistory));
                } catch (e) {
                    console.error("Error al guardar el historial:", e);
                }
            }

            addPokemonToHistory(id) {
                const idString = String(id);
                if (!this.scannedHistory[idString]) {
                    this.scannedHistory[idString] = true;
                    this.saveHistory();
                    console.log(`Guardado Pokémon #${idString} en el historial.`);
                }
            }

            openHistoryScreen() {
                document.getElementById('historyModal').style.display = 'block';
                this.displayHistory();
            }

            displayHistory() {
                const grid = document.getElementById('historyGrid');
                grid.innerHTML = ''; 
                
                for (let i = 1; i <= this.maxPokemonId; i++) {
                    const number = i.toString().padStart(3, '0');
                    const isScanned = !!this.scannedHistory[String(i)]; 
                    
                    const div = document.createElement('div');
                    div.className = `history-item ${isScanned ? 'scanned' : 'unscanned'}`;
                    div.textContent = `#${number}`;
                    div.dataset.pokemonId = i;
                    
                    if (isScanned) {
                        div.addEventListener('click', () => {
                            this.currentPokemonId = i;
                            this.loadPokemon(i);
                            document.getElementById('historyModal').style.display = 'none';
                        });
                    }
                    
                    grid.appendChild(div);
                }
            }

            // --- Funciones de la Pokédex (Resto) ---

            updateNavigationButtons() {
                const prevBtn = document.getElementById('prevBtn');
                const nextBtn = document.getElementById('nextBtn');
                prevBtn.disabled = this.currentPokemonId <= 1;
                nextBtn.disabled = this.currentPokemonId >= this.maxPokemonId;
            }

            switchCamera(cameraType) {
                this.currentCamera = cameraType;
                document.getElementById('frontCamera').classList.toggle('active', cameraType === 'user');
                document.getElementById('rearCamera').classList.toggle('active', cameraType === 'environment');
                
                if (this.isScanning) {
                    this.closeQRScanner(false).then(() => { 
                        this.openQRScanner();
                    });
                }
            }

            async openQRScanner() {
                const modal = document.getElementById('qrModal');
                const cameraError = document.getElementById('cameraError');
                
                if (this.cameraLocked) {
                    modal.style.display = 'block';
                    cameraError.innerHTML = `
                        <h3>🛑 ERROR PERSISTENTE 🛑</h3>
                        <p>El recurso de la cámara está bloqueado por el navegador.</p>
                        <p>Por favor, **RECARGA LA PÁGINA** para liberar el bloqueo y volver a intentarlo.</p>
                    `;
                    cameraError.style.display = 'block';
                    document.querySelector('.camera-options').style.display = 'none';
                    return;
                }
                
                cameraError.innerHTML = `
                    <h3>❌ ERROR DE CÁMARA</h3>
                    <p>No se pudo acceder a la cámara</p>
                    <p>1. Haz clic en el ícono de 🔒 o 📷</p>
                    <p>2. Selecciona "Permitir"</p>
                    <p>3. Recarga la página si es necesario</p>
                    <button id="retryCamera" class="retry-btn">REINTENTAR</button>
                `;
                document.getElementById('retryCamera').addEventListener('click', () => this.openQRScanner());
                document.querySelector('.camera-options').style.display = 'flex'; 

                if (modal.style.display !== 'block' || !this.isScanning) {
                    history.pushState({ modal: 'qrScanner' }, 'QR Scanner');
                }
                
                modal.style.display = 'block';
                cameraError.style.display = 'none';
                
                if (typeof Html5Qrcode === 'undefined') {
                    console.error('❌ Librería QR no cargada');
                    this.showCameraError();
                    return;
                }
                
                if (this.qrScanner) {
                    await this.closeQRScanner(false); 
                }

                let qrReader = document.getElementById('qrReader');
                if (!qrReader) {
                    const qrContainer = document.querySelector('.scanner-container'); 
                    if (qrContainer) {
                        qrReader = document.createElement('div');
                        qrReader.id = 'qrReader';
                        qrContainer.prepend(qrReader); 
                    } else {
                        console.error("FALTA .scanner-container en index.html o estructura incorrecta.");
                        this.showCameraError();
                        return;
                    }
                }
                
                this.isScanning = true;
                this.qrScanner = new Html5Qrcode("qrReader"); 

                try {
                    const config = {
                        fps: 10,
                        qrbox: { width: 200, height: 200 }
                    };

                    await new Promise(resolve => setTimeout(resolve, 100)); 
                    
                    await this.qrScanner.start(
                        { 
                            facingMode: this.currentCamera
                        },
                        config,
                        (decodedText) => {
                            this.onQRScanSuccess(decodedText);
                        },
                        (error) => {}
                    );
                    
                    this.cameraLocked = false; 

                } catch (error) {
                    console.error("❌ Error al iniciar cámara:", error);
                    
                    this.cameraLocked = true;
                    this.showCameraError();
                    this.isScanning = false;
                    
                    if (this.currentCamera === "environment") {
                        setTimeout(() => {
                            this.switchCamera('user');
                        }, 1000);
                    }
                }
            }

            async onQRScanSuccess(decodedText) {
                if (!this.isScanning) return;
                
                let idFound = false;
                let pokemonId = null;
                const maxId = this.maxPokemonId;
                const trimmedText = decodedText.trim();
                
                console.log("QR escaneado (Texto original):", trimmedText); 
                
                pokemonId = parseInt(trimmedText);

                if (isNaN(pokemonId) || pokemonId < 1 || pokemonId > maxId) {
                    const match = trimmedText.match(/(\d+)\/?$/); 
                    if (match && match[1]) {
                        pokemonId = parseInt(match[1]);
                    }
                }
                
                if (pokemonId >= 1 && pokemonId <= maxId) {
                    idFound = true;
                }

                if (idFound) {
                    console.log("✅ ID de Pokémon válido encontrado. Cargando:", pokemonId); 
                    
                    this.isScanning = false;
                    await this.closeQRScanner();
                    
                    this.addPokemonToHistory(pokemonId);
                    
                    document.getElementById('pokemonInput').value = pokemonId; 
                    
                    this.currentPokemonId = pokemonId;
                    this.loadPokemon(pokemonId);
                } else {
                    console.error(`❌ El QR no contiene un ID válido (1-${maxId}). Valor extraído:`, pokemonId); 
                    await this.closeQRScanner();
                    
                    document.getElementById('pokemonInput').value = '';
                    this.showError(); 
                    setTimeout(() => this.hideError(), 3000); 
                }
            }
            
            async closeQRScanner(popHistory = true) {
                
                document.getElementById('qrModal').style.display = 'none';

                this.isScanning = false;
                
                if (this.qrScanner) {
                    
                    if (this.qrScanner.isScanning()) {
                        try {
                            await this.qrScanner.stop(); 
                        } catch (error) {
                            console.error("Error al detener el stream de video:", error);
                        }
                    }
                    
                    try {
                        this.qrScanner.clear();
                    } catch (clearError) {
                        console.error("Error al limpiar el escáner (clear):", clearError);
                    }
                    
                    this.qrScanner = null; 
                    
                    const qrReaderElement = document.getElementById('qrReader');
                    if (qrReaderElement) {
                        qrReaderElement.remove(); 
                    }
                }

                if (popHistory && window.history.state && window.history.state.modal === 'qrScanner') {
                    history.back(); 
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
            
            showCameraError() {
                document.getElementById('cameraError').style.display = 'block';
            }

            // --- Funciones de la Pokédex (El resto permanece igual) ---

            async searchPokemon() {
                const input = document.getElementById('pokemonInput').value.trim();
                if (!input) return;

                this.showLoading();

                try {
                    let pokemonId;
                    
                    if (!isNaN(input)) {
                        pokemonId = parseInt(input);
                        if (pokemonId < 1 || pokemonId > this.maxPokemonId) {
                            throw new Error('Número no válido');
                        }
                    } else {
                        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${input.toLowerCase()}`);
                        if (!response.ok) throw new Error('Pokémon no encontrado');
                        const data = await response.json();
                        pokemonId = data.id;
                    }

                    this.currentPokemonId = pokemonId;
                    await this.loadPokemon(pokemonId);
                    document.getElementById('pokemonInput').value = '';

                } catch (error) {
                    this.showError();
                }
            }

            async loadPokemon(id) {
                this.showLoading();

                try {
                    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
                    if (!response.ok) throw new Error('Pokémon no encontrado');
                    
                    const data = await response.json();
                    this.displayPokemon(data);
                    this.hideError();

                } catch (error) {
                    this.showError();
                }
            }

            displayPokemon(pokemon) {
                document.getElementById('pokemonName').textContent = this.capitalizeFirst(pokemon.name);
                document.getElementById('pokemonId').textContent = `#${pokemon.id.toString().padStart(3, '0')}`;
                
                const sprite = document.getElementById('pokemonSprite');
                
                let pixelSprite = pokemon.sprites.front_default;
                
                if (pokemon.sprites.versions && 
                    pokemon.sprites.versions['generation-v'] && 
                    pokemon.sprites.versions['generation-v']['black-white'] && 
                    pokemon.sprites.versions['generation-v']['black-white'].animated) {
                    pixelSprite = pokemon.sprites.versions['generation-v']['black-white'].animated.front_default || pokemon.sprites.front_default;
                }
                
                sprite.src = pixelSprite;
                sprite.style.display = 'block';
                
                this.displayTypes(pokemon.types);
                document.getElementById('pokemonHeight').textContent = `${(pokemon.height / 10).toFixed(1)} m`;
                document.getElementById('pokemonWeight').textContent = `${(pokemon.weight / 10).toFixed(1)} kg`;
                
                this.displayAbilities(pokemon.abilities);
                this.displayStats(pokemon.stats);
                
                this.updateNavigationButtons(); 
                this.hideLoading();
            }

            displayTypes(types) {
                const typesContainer = document.getElementById('pokemonTypes');
                typesContainer.innerHTML = '';

                types.forEach(typeInfo => {
                    const typeElement = document.createElement('span');
                    typeElement.className = `type-badge type-${typeInfo.type.name}`;
                    typeElement.textContent = typeInfo.type.name.toUpperCase();
                    typesContainer.appendChild(typeElement);
                });
            }

            displayAbilities(abilities) {
                const abilitiesContainer = document.getElementById('pokemonAbilities');
                abilitiesContainer.innerHTML = '';

                abilities.forEach(abilityInfo => {
                    const abilityElement = document.createElement('span');
                    abilityElement.className = 'ability';
                    abilityElement.textContent = abilityInfo.ability.name.replace('-', ' ');
                    abilitiesContainer.appendChild(abilityElement);
                });
            }

            displayStats(stats) {
                const statsContainer = document.getElementById('pokemonStats');
                const statItems = statsContainer.querySelectorAll('.stat-item');
                
                const statMapping = {
                    'hp': 0,
                    'attack': 1,
                    'defense': 2,
                    'special-attack': 3,
                    'special-defense': 4,
                    'speed': 5
                };

                stats.forEach(stat => {
                    const index = statMapping[stat.stat.name];
                    if (index !== undefined && statItems[index]) {
                        statItems[index].querySelector('.stat-value').textContent = stat.base_stat;
                    }
                });
            }

            previousPokemon() {
                if (this.currentPokemonId > 1) {
                    this.currentPokemonId--;
                    this.loadPokemon(this.currentPokemonId);
                }
            }

            nextPokemon() {
                if (this.currentPokemonId < this.maxPokemonId) {
                    this.currentPokemonId++;
                    this.loadPokemon(this.currentPokemonId);
                }
            }

            loadRandomPokemon() {
                const randomId = Math.floor(Math.random() * this.maxPokemonId) + 1;
                this.currentPokemonId = randomId;
                this.loadPokemon(randomId);
            }

            showLoading() {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('pokemonSprite').style.display = 'none';
            }

            hideLoading() {
                document.getElementById('loading').style.display = 'none';
            }

            showError() {
                document.getElementById('errorMessage').style.display = 'block';
                this.hideLoading();
            }

            hideError() {
                document.getElementById('errorMessage').style.display = 'none';
            }

            capitalizeFirst(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            new Pokedex();
        });