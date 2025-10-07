class Pokedex {
            constructor() {
                this.currentPokemonId = 1;
                this.maxPokemonId = 1025;
                this.qrScanner = null;
                this.isScanning = false;
                this.currentCamera = "environment"; 
                this.cameraLocked = false; // <-- NUEVA BANDERA DE CONTROL DE ERRORES
                this.initializeEventListeners();
                this.loadPokemon(this.currentPokemonId);
            }

            initializeEventListeners() {
                document.getElementById('searchBtn').addEventListener('click', () => this.searchPokemon());
                document.getElementById('qrBtn').addEventListener('click', () => this.openQRScanner());
                document.getElementById('prevBtn').addEventListener('click', () => this.previousPokemon());
                document.getElementById('nextBtn').addEventListener('click', () => this.nextPokemon());
                document.getElementById('randomBtn').addEventListener('click', () => this.loadRandomPokemon());
                
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
                
                // 1. Detección de Bloqueo Persistente
                if (this.cameraLocked) {
                    modal.style.display = 'block';
                    cameraError.innerHTML = `
                        <h3>🛑 ERROR PERSISTENTE 🛑</h3>
                        <p>El recurso de la cámara está bloqueado por el navegador.</p>
                        <p>Por favor, **RECARGA LA PÁGINA** para liberar el bloqueo y volver a intentarlo.</p>
                    `;
                    cameraError.style.display = 'block';
                    document.querySelector('.camera-options').style.display = 'none'; // Oculta botones si hay error fatal
                    return;
                }
                
                // Si la cámara no está bloqueada, limpiamos el mensaje de error anterior
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

                // *** RECREACIÓN del elemento #qrReader ***
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
                    
                    // Si el inicio fue exitoso, el bloqueo anterior se ha resuelto
                    this.cameraLocked = false; 

                } catch (error) {
                    console.error("❌ Error al iniciar cámara:", error);
                    
                    // Si falla el inicio, marcamos la bandera para el siguiente intento
                    this.cameraLocked = true;
                    this.showCameraError();
                    this.isScanning = false;
                    
                    // Intento de recuperación forzada si el error fue por cámara por defecto
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
                
                // DELAY EXTENDIDO (1 segundo)
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
            
            showCameraError() {
                document.getElementById('cameraError').style.display = 'block';
            }

            // --- Funciones de la Pokédex (No modificadas) ---

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