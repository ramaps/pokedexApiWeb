class Pokedex {
    constructor() {
        this.currentPokemonId = 1;
        this.maxPokemonId = 1025; // Número máximo de Pokémon (hasta la generación 9)
        this.qrScanner = null;
        this.isScanning = false;
        this.currentCamera = "environment"; // Inicia con la cámara trasera
        this.cameraLocked = false; 

        this.HISTORY_STORAGE_KEY = 'pokedex_scanned_history';
        this.scannedHistory = this.loadHistory(); // Carga el historial
        
        this.initializeEventListeners();
        this.loadPokemon(this.currentPokemonId);
    }

    /** Inicializa todos los event listeners de forma segura, verificando la existencia de los elementos. */
    initializeEventListeners() {
        // Función auxiliar para adjuntar listeners solo si el elemento existe
        const safeAddListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Elemento con ID '${id}' no encontrado. La función asociada estará deshabilitada.`);
            }
        };

        // 1. Pokédex Core y Navegación
        safeAddListener('searchBtn', 'click', () => this.searchPokemon());
        safeAddListener('prevBtn', 'click', () => this.previousPokemon());
        safeAddListener('nextBtn', 'click', () => this.nextPokemon());
        safeAddListener('randomBtn', 'click', () => this.loadRandomPokemon());
        
        safeAddListener('pokemonInput', 'keypress', (e) => {
            if (e.key === 'Enter') this.searchPokemon();
        });

        // 2. Historial Features
        safeAddListener('historyBtn', 'click', () => this.openHistoryScreen());
        
        // Cerrar Modal de Historial
        safeAddListener('closeHistoryModal', 'click', () => {
             const modal = document.getElementById('historyModal');
             if(modal) modal.style.display = 'none';
        });
        
        // Importar/Exportar
        safeAddListener('exportHistoryBtn', 'click', () => this.exportHistoryToTxt());
        safeAddListener('importFile', 'change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.importHistoryFromTxt(e.target.files[0]);
            }
            e.target.value = null; // Permite re-seleccionar el mismo archivo
        });

        // 3. QR/Cámara Features
        safeAddListener('qrBtn', 'click', () => this.openQRScanner());
        safeAddListener('closeModal', 'click', () => this.closeQRScanner()); 
        safeAddListener('retryCamera', 'click', () => this.openQRScanner());
        safeAddListener('frontCamera', 'click', () => this.switchCamera('user'));
        safeAddListener('rearCamera', 'click', () => this.switchCamera('environment'));
        
        // Cerrar el modal QR al hacer clic fuera del contenido
        const qrModal = document.getElementById('qrModal');
        if (qrModal) {
            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) {
                    this.closeQRScanner();
                }
            });
        }

        // 4. Popstate para cerrar el modal QR con el botón "atrás" del navegador
        window.addEventListener('popstate', () => {
            const currentModal = window.history.state ? window.history.state.modal : null;
            if (this.isScanning && currentModal !== 'qrScanner') {
                this.closeQRScanner(false); 
            }
        });
        
        this.updateNavigationButtons();
    }
    
    // --- Funciones de Historial (Persistencia, Visualización y Backup) ---

    /** Carga el historial de IDs escaneados desde localStorage. */
    loadHistory() {
        try {
            const historyJson = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            return historyJson ? JSON.parse(historyJson) : {}; 
        } catch (e) {
            console.error("Error al cargar el historial:", e);
            return {};
        }
    }

    /** Guarda el historial de IDs escaneados a localStorage. */
    saveHistory() {
        try {
            localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(this.scannedHistory));
        } catch (e) {
            console.error("Error al guardar el historial:", e);
        }
    }

    /** Agrega un Pokémon al historial si no está ya presente. */
    addPokemonToHistory(id) {
        const idString = String(id);
        if (!this.scannedHistory[idString]) {
            this.scannedHistory[idString] = true;
            this.saveHistory();
            console.log(`Guardado Pokémon #${idString} en el historial.`);
        }
    }

    /** Abre la pantalla del modal de historial y actualiza la cuadrícula. */
    openHistoryScreen() {
        const modal = document.getElementById('historyModal');
        if(modal) {
            modal.style.display = 'block';
            this.displayHistory();
        } 
    }

    /** Dibuja la cuadrícula completa de Pokémon (escaneados vs. no escaneados) CON MINITURAS. */
    displayHistory() {
        const grid = document.getElementById('historyGrid');
        if (!grid) return;
        
        grid.innerHTML = ''; // Limpia la cuadrícula
        
        for (let i = 1; i <= this.maxPokemonId; i++) {
            const number = i.toString().padStart(3, '0');
            const isScanned = !!this.scannedHistory[String(i)]; 
            
            const div = document.createElement('div');
            // Clase base para todos
            div.className = `history-item ${isScanned ? 'scanned' : 'unscanned'}`;
            div.dataset.pokemonId = i;
            
            if (isScanned) {
                // 1. Crear el elemento de la imagen (Miniatura)
                const img = document.createElement('img');
                // Usamos el sprite frontal estático básico
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;
                img.alt = `Pokémon #${i}`;
                img.classList.add('history-sprite');
                
                // 2. Crear el elemento del número
                const p = document.createElement('p');
                p.textContent = `#${number}`;
                p.classList.add('history-number');

                // 3. Añadir ambos elementos al div
                div.appendChild(img);
                div.appendChild(p);
                
                // 4. Añadir Listener para cargar el Pokémon al hacer clic
                div.addEventListener('click', () => {
                    this.currentPokemonId = i;
                    this.loadPokemon(i);
                    document.getElementById('historyModal').style.display = 'none';
                });
            } else {
                 // Para los no escaneados, solo mostramos el número
                 div.textContent = `#${number}`; 
            }
            
            grid.appendChild(div);
        }
    }
    
    /** Exporta el historial de IDs a un archivo de texto (.txt). */
    exportHistoryToTxt() {
        const historyIds = Object.keys(this.scannedHistory).join(',');
        
        if (!historyIds) {
            alert('No hay Pokémon escaneados para exportar.');
            return;
        }
        
        const blob = new Blob([historyIds], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `pokedex_history_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Historial exportado con éxito. ¡Busca el archivo en tu carpeta de descargas!');
    }

    /** Importa un archivo de texto (.txt) con IDs de Pokémon y los fusiona con el historial existente. */
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
                    alert('El archivo no contiene IDs de Pokémon válidos (1-1025).');
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

        reader.readAsText(file);
    }
    
    // --- Funciones de la Pokédex Core y QR ---
    
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.disabled = this.currentPokemonId <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPokemonId >= this.maxPokemonId;
    }
    
    updateCameraButtons() {
        const frontBtn = document.getElementById('frontCamera');
        const rearBtn = document.getElementById('rearCamera');
        if (frontBtn) frontBtn.classList.toggle('active', this.currentCamera === 'user');
        if (rearBtn) rearBtn.classList.toggle('active', this.currentCamera === 'environment');
    }

    switchCamera(cameraType) {
        this.currentCamera = cameraType;
        this.updateCameraButtons();
        
        if (this.isScanning) {
            // Reinicia el escáner con la nueva cámara
            this.closeQRScanner(false).then(() => { 
                this.openQRScanner();
            });
        }
    }

    async openQRScanner() {
        const modal = document.getElementById('qrModal');
        const cameraError = document.getElementById('cameraError');
        
        if (!modal || !cameraError) return;

        // Mostrar error persistente si la cámara está bloqueada
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
        
        // Configuración inicial del modal/error
        cameraError.style.display = 'none';
        document.querySelector('.camera-options').style.display = 'flex'; 

        if (modal.style.display !== 'block' || !this.isScanning) {
            history.pushState({ modal: 'qrScanner' }, 'QR Scanner');
        }
        
        modal.style.display = 'block';
        
        if (typeof Html5Qrcode === 'undefined') {
            console.error('❌ Librería QR no cargada');
            this.showCameraError();
            return;
        }
        
        // Detener escáner anterior si existe
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

            await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa
            
            await this.qrScanner.start(
                { 
                    facingMode: this.currentCamera
                },
                config,
                (decodedText) => {
                    this.onQRScanSuccess(decodedText);
                },
                (error) => {} // Función de error de escaneo (no de inicio de cámara)
            );
            
            this.cameraLocked = false; 

        } catch (error) {
            console.error("❌ Error al iniciar cámara:", error);
            
            this.cameraLocked = true;
            this.showCameraError();
            this.isScanning = false;
            
            // Intenta cambiar a la otra cámara automáticamente si falla
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
        
        // 1. Intenta parsear directamente
        pokemonId = parseInt(trimmedText);

        // 2. Si falla, intenta extraer un número de una URL
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
            
            this.addPokemonToHistory(pokemonId);
            
            document.getElementById('pokemonInput').value = pokemonId; 
            
            this.currentPokemonId = pokemonId;
            this.loadPokemon(pokemonId);
        } else {
            await this.closeQRScanner();
            
            document.getElementById('pokemonInput').value = '';
            this.showError('Código QR no contiene un ID de Pokémon válido (1-1025).'); 
            setTimeout(() => this.hideError(), 3000); 
        }
    }
    
    async closeQRScanner(popHistory = true) {
        const modal = document.getElementById('qrModal');
        if (modal) modal.style.display = 'none';

        this.isScanning = false;
        
        if (this.qrScanner) {
            try {
                if (this.qrScanner.isScanning()) {
                    await this.qrScanner.stop(); 
                }
            } catch (error) {
                console.error("Error al detener el stream de video:", error);
            }
            
            try {
                this.qrScanner.clear();
            } catch (clearError) {
                console.warn("Error al limpiar el escáner:", clearError);
            }
            
            this.qrScanner = null; 
        }
        
        const qrReaderElement = document.getElementById('qrReader');
        if (qrReaderElement) {
            qrReaderElement.remove(); 
        }
        
        if (popHistory && window.history.state && window.history.state.modal === 'qrScanner') {
            history.back(); 
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    
    showCameraError() {
        const cameraError = document.getElementById('cameraError');
        if (cameraError) {
            cameraError.style.display = 'block';
            document.querySelector('.scanner-overlay').style.display = 'none';
            // Re-adjuntar listener para el botón de reintento si fue sobrescrito
            document.getElementById('retryCamera').addEventListener('click', () => this.openQRScanner());
        }
    }
    
    // --- Funciones de la Pokédex (Resto) ---

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
            this.hideError();

        } catch (error) {
            this.showError('Pokémon no encontrado o ID fuera de rango (1-1025).');
        }
    }

    async loadPokemon(id) {
        this.showLoading();
        this.hideError();
        this.currentPokemonId = id;

        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            if (!response.ok) throw new Error('Pokémon no encontrado');
            
            const data = await response.json();
            this.displayPokemon(data);
            this.addPokemonToHistory(id); // Marca como escaneado al cargar
            this.hideError();

        } catch (error) {
            this.showError('Error al cargar datos del Pokémon.');
        }
    }

    displayPokemon(pokemon) {
        document.getElementById('pokemonName').textContent = this.capitalizeFirst(pokemon.name);
        document.getElementById('pokemonId').textContent = `#${pokemon.id.toString().padStart(3, '0')}`;
        
        const sprite = document.getElementById('pokemonSprite');
        
        // Intenta obtener el sprite animado de Black/White, si no, usa el default
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
            abilityElement.textContent = this.capitalizeFirst(abilityInfo.ability.name.replace('-', ' '));
            abilitiesContainer.appendChild(abilityElement);
        });
    }

    displayStats(stats) {
        const statsContainer = document.getElementById('pokemonStats');
        const statItems = statsContainer.querySelectorAll('.stat-item');
        
        const statNames = ['HP', 'ATAQUE', 'DEFENSA', 'AT.ESP', 'DEF.ESP', 'VELOCIDAD'];
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
                statItems[index].querySelector('.stat-name').textContent = statNames[index];
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
        const loading = document.getElementById('loading');
        const sprite = document.getElementById('pokemonSprite');
        if (loading) loading.style.display = 'block';
        if (sprite) sprite.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    showError(message = 'Pokémon no encontrado') {
        const error = document.getElementById('errorMessage');
        if (error) {
            error.textContent = message;
            error.style.display = 'block';
        }
        this.hideLoading();
    }

    hideError() {
        const error = document.getElementById('errorMessage');
        if (error) error.style.display = 'none';
    }

    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).replace(/-/g, ' ');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Pokedex();
});