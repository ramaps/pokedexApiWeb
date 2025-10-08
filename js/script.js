class Pokedex {
    constructor() {
        this.currentPokemonId = 0;
        this.maxPokemonId = 1025; // Número máximo de Pokémon (hasta la generación 9)
        this.qrScanner = null;
        this.isScanning = false;
        this.currentCamera = "environment"; // Inicia con la cámara trasera
        this.cameraLocked = false; 

        this.HISTORY_STORAGE_KEY = 'pokedex_scanned_history';
        this.scannedHistory = this.loadHistory(); // Carga el historial
        
        this.initializeEventListeners();
        // Carga el Pokémon #0 que es el estado inicial
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
                // Advertencia solo si el elemento *debería* existir (ej. Historial, QR)
                if (['historyBtn', 'qrBtn', 'closeHistoryModal', 'exportHistoryBtn', 'importFile', 'closeModal', 'retryCamera', 'frontCamera', 'rearCamera'].includes(id)) {
                    console.warn(`Elemento con ID '${id}' no encontrado. La función asociada estará deshabilitada.`);
                }
            }
        };

        // 1. Pokédex Core: Ahora solo se activa con la tecla ENTER
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
                // Forzar el cierre de la cámara si el usuario usa el botón de retroceso
                this.closeQRScanner(false); 
            }
        });
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
        
        // Reemplazando alert()
        const modalMessage = document.getElementById('errorMessage');
        const showTempMessage = (msg) => {
            if (modalMessage) {
                modalMessage.textContent = msg;
                modalMessage.style.display = 'block';
                setTimeout(() => modalMessage.style.display = 'none', 3000);
            }
        };

        if (!historyIds) {
            showTempMessage('No hay Pokémon escaneados para exportar.');
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
        
        showTempMessage('Historial exportado con éxito. ¡Busca el archivo en tu carpeta de descargas!');
    }

    /** Importa un archivo de texto (.txt) con IDs de Pokémon y los fusiona con el historial existente. */
    importHistoryFromTxt(file) {
        // Reemplazando alert()
        const modalMessage = document.getElementById('errorMessage');
        const showTempMessage = (msg) => {
            if (modalMessage) {
                modalMessage.textContent = msg;
                modalMessage.style.display = 'block';
                setTimeout(() => modalMessage.style.display = 'none', 4000);
            }
        };

        if (!file) {
            showTempMessage('Por favor, selecciona un archivo .txt de historial.');
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
                    showTempMessage('El archivo no contiene IDs de Pokémon válidos (1-1025).');
                    return;
                }

                // Fusiona el historial existente con el nuevo
                ids.forEach(id => {
                    this.scannedHistory[String(id)] = true;
                });

                this.saveHistory();
                this.displayHistory();
                
                showTempMessage(`Historial importado y fusionado con éxito. ${ids.length} Pokémon encontrados.`);

            } catch (error) {
                console.error('Error al leer el archivo de historial:', error);
                showTempMessage('Hubo un error al procesar el archivo. Asegúrate de que es un .txt válido.');
            }
        };

        reader.readAsText(file);
    }
    
    // --- Funciones de la Pokédex Core y QR ---
    
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
            this.showCameraError('Librería QR no cargada.');
            return;
        }
        
        // Detener escáner anterior si existe y limpiar el elemento DOM
        if (this.qrScanner) {
            await this.closeQRScanner(false); 
        }

        // Crear dinámicamente el div donde se renderizará el escáner (CRUCIAL para reinicios limpios)
        let qrReader = document.getElementById('qrReader');
        if (!qrReader) {
            const qrContainer = document.querySelector('.scanner-container'); 
            if (qrContainer) {
                qrReader = document.createElement('div');
                qrReader.id = 'qrReader';
                qrContainer.prepend(qrReader); 
            } else {
                this.showCameraError('Contenedor del escáner no encontrado.');
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

            // Pequeña pausa para asegurar que el DOM está listo
            await new Promise(resolve => setTimeout(resolve, 100)); 
            
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
            this.showCameraError('Error al iniciar la cámara. Permite el acceso o recarga la página.');
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
            
            // **IMPORTANTE:** Detener y limpiar el escáner INMEDIATAMENTE al tener éxito
            await this.closeQRScanner();
            
            this.addPokemonToHistory(pokemonId);
            
            document.getElementById('pokemonInput').value = pokemonId; 
            
            this.currentPokemonId = pokemonId;
            this.loadPokemon(pokemonId);
        } else {
            // Si no se encuentra un ID válido, detiene el escáner y muestra un error temporal
            await this.closeQRScanner();
            
            document.getElementById('pokemonInput').value = '';
            this.showError('Código QR no contiene un ID de Pokémon válido (1-1025).'); 
            setTimeout(() => this.hideError(), 3000); 
        }
    }
    
    /**
     * Detiene el stream de video de la cámara y limpia la instancia del escáner.
     * ESTA ES LA FUNCIÓN CRÍTICA CORREGIDA.
     * @param {boolean} popHistory Indica si debe retroceder en el historial del navegador.
     */
    async closeQRScanner(popHistory = true) {
        const modal = document.getElementById('qrModal');
        if (modal) modal.style.display = 'none';

        this.isScanning = false;
        
        if (this.qrScanner) {
            try {
                // 1. Detener el stream de video. Esto es lo que libera el recurso de la cámara.
                await this.qrScanner.stop(); 
                console.log("Stream de cámara detenido y recurso liberado.");
            } catch (error) {
                // Se ignora si ya estaba detenido o falló la liberación (común en ciertos estados)
                console.warn("Advertencia al detener el stream:", error);
            }
            
            try {
                // 2. Limpiar la instancia.
                this.qrScanner.clear();
            } catch (clearError) {
                console.warn("Error al limpiar la instancia del escáner:", clearError);
            }
            
            this.qrScanner = null; // Reinicia la referencia para una nueva instancia
        }
        
        // 3. Eliminar el div del DOM para un reinicio limpio
        const qrReaderElement = document.getElementById('qrReader');
        if (qrReaderElement) {
            qrReaderElement.remove(); 
        }
        
        if (popHistory && window.history.state && window.history.state.modal === 'qrScanner') {
            history.back(); 
        }
    }
    
    showCameraError(message = 'Error al iniciar la cámara. Presiona REINTENTAR.') {
        const cameraError = document.getElementById('cameraError');
        if (cameraError) {
            cameraError.style.display = 'block';
            cameraError.querySelector('h3').textContent = 'Error de Cámara';
            cameraError.querySelector('p').textContent = message;
            
            // Asegura que el botón de reintento no esté oculto si el contenedor existe
            const options = document.querySelector('.camera-options');
            if (options) options.style.display = 'flex';
        }
    }
    
    // --- Funciones de la Pokédex (Resto) ---

    async searchPokemon() {
        const input = document.getElementById('pokemonInput').value.trim();
        if (!input) {
             this.showError('Ingresa un número o nombre para buscar.');
             return;
        }

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
        
        // Si el ID es 0, solo resetea la pantalla (estado inicial)
        if (id === 0) {
            this.resetDisplay();
            this.hideLoading();
            return;
        }

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
        
        this.hideLoading();
    }
    
    resetDisplay() {
        document.getElementById('pokemonName').textContent = 'POKÉDEX LISTA';
        document.getElementById('pokemonId').textContent = '#000';
        // Resetear otros campos a su estado inicial
        document.getElementById('pokemonHeight').textContent = '--- m';
        document.getElementById('pokemonWeight').textContent = '--- kg';
        document.getElementById('pokemonSprite').style.display = 'none';

        // Resetear Tipos
        const typesContainer = document.getElementById('pokemonTypes');
        if (typesContainer) typesContainer.innerHTML = '';
        
        // Resetear Habilidades
        const abilitiesContainer = document.getElementById('pokemonAbilities');
        if (abilitiesContainer) abilitiesContainer.innerHTML = '';
        
        // Resetear Stats
        const statsContainer = document.getElementById('pokemonStats');
        if (statsContainer) {
            const statItems = statsContainer.querySelectorAll('.stat-item');
            const statNames = ['HP', 'ATAQUE', 'DEFENSA', 'AT.ESP', 'DEF.ESP', 'VELOCIDAD'];
            statItems.forEach((item, index) => {
                item.querySelector('.stat-value').textContent = '---';
                item.querySelector('.stat-name').textContent = statNames[index] || '---';
            });
        }

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