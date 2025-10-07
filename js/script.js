class Pokedex {
            constructor() {
                this.currentPokemonId = 1;
                this.maxPokemonId = 1025;
                this.qrScanner = null;
                this.isScanning = false;
                this.currentCamera = "environment"; 
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

                // *** PASO CRÍTICO: RECREAR el elemento #qrReader ***
                let qrReader = document.getElementById('qrReader');
                if (!qrReader) {
                    const qrContainer = document.getElementById('qrContainer');
                    if (qrContainer) {
                        qrReader = document.createElement('div');
                        qrReader.id = 'qrReader';
                        qrContainer.appendChild(qrReader);
                        console.log("✨ Elemento #qrReader recreado.");
                    } else {
                        console.error("FALTA #qrContainer en index.html. La reapertura fallará.");
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
                    
                } catch (error) {
                    console.error("❌ Error al iniciar cámara:", error);
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
                    this.isScanning = false;
                    await this.closeQRScanner();
                    this.currentPokemonId = pokemonId;
                    this.loadPokemon(pokemonId);
                }
            }
            
            async closeQRScanner(popHistory = true) {
                
                // 1. PRIORIDAD UX: Ocultar el modal de inmediato
                document.getElementById('qrModal').style.display = 'none';

                this.isScanning = false;
                
                // 2. DETENER Y LIBERAR RECURSOS
                if (this.qrScanner) {
                    
                    // A. Detenemos el stream de video
                    if (this.qrScanner.isScanning()) {
                        try {
                            await this.qrScanner.stop();
                        } catch (error) {
                            console.error("Error al detener el stream de video:", error);
                        }
                    }
                    
                    // B. Forzamos la limpieza y DESTRUCCIÓN DEL ELEMENTO
                    try {
                        this.qrScanner.clear();
                    } catch (clearError) {
                        console.error("Error al limpiar el escáner (clear):", clearError);
                    }
                    
                    this.qrScanner = null; // Liberamos la instancia
                    
                    // *** PASO CRÍTICO: DESTRUCCIÓN TOTAL DEL ELEMENTO QR ***
                    const qrReaderElement = document.getElementById('qrReader');
                    if (qrReaderElement) {
                        qrReaderElement.remove(); // Elimina el elemento del DOM
                        console.log("🔥 Elemento #qrReader destruido.");
                    }
                }

                // 3. MANEJO DEL BOTÓN ATRÁS
                if (popHistory && window.history.state && window.history.state.modal === 'qrScanner') {
                    history.back(); 
                }
                
                // 4. DELAY FORZADO para asegurar la liberación del recurso
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            showCameraError() {
                document.getElementById('cameraError').style.display = 'block';
            }

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