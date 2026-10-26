// 1. Configuración de endpoints y variables de automatización n8n
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/pedidos-serigraph";
const N8N_WEBHOOK_MUESTRAS = "http://localhost:5678/webhook-test/solicitud-muestra-serigraph";
const TELEFONO_WHATSAPP = "5214621954045";

let imagenDisenoActual = "https://miservidor.com/mockups/funda-sol-default.png";

// 2. Redirección general a WhatsApp
function enviarWhatsAppGeneral() {
    const mensaje = encodeURIComponent("¡Hola Pixelcraft! Quisiera más información sobre sus servicios de serigrafía e impresión 3D a la medida.");
    window.open(`whatsapp://send?phone=${TELEFONO_WHATSAPP}&text=${mensaje}`, '_self');
}

// 3. Disparo de cotización directa por producto
function cotizarProducto(nombreProducto, precio) {
    const datosPedido = {
        producto: nombreProducto,
        precioEstimado: precio,
        fecha: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(datosPedido)], { type: 'application/json' });
    navigator.sendBeacon(N8N_WEBHOOK_URL, blob);

    const mensaje = encodeURIComponent(`¡Hola! Me interesa cotizar:\n- *Producto:* ${nombreProducto}\n- *Precio estimado:* $${precio} MXN\n\n¿Cuáles son los pasos para iniciar?`);
    window.open(`whatsapp://send?phone=${TELEFONO_WHATSAPP}&text=${mensaje}`, '_self');
}

// 4. Control del Modal de Muestras
function abrirModalMuestra(urlImagen = null) {
    if (urlImagen) {
        imagenDisenoActual = urlImagen;
    }
    document.getElementById("modalMuestra").style.display = "flex";
}

function cerrarModalMuestra() {
    document.getElementById("modalMuestra").style.display = "none";
}

// 5. Envío de datos de muestras al webhook de n8n
document.getElementById("formMuestra").addEventListener("submit", async function(event) {
    event.preventDefault();

    const direccionEstructurada = `${document.getElementById("calleNumero").value.trim()}, Col. ${document.getElementById("colonia").value.trim()}, C.P. ${document.getElementById("codigoPostal").value.trim()}, ${document.getElementById("ciudadEstado").value.trim()}`;

    const payloadEnvio = {
        nombreCliente: document.getElementById("nombreCliente").value.trim(),
        telefonoWhatsApp: document.getElementById("telefonoWhatsApp").value.trim(),
        correoElectronico: document.getElementById("correoElectronico").value.trim(),
        direccionEnvio: direccionEstructurada,
        urlImagenDiseno: imagenDisenoActual,
        tipoSolicitud: document.getElementById("tipoSolicitud").value,
        fechaSolicitud: new Date().toISOString()
    };

    try {
        const respuesta = await fetch(N8N_WEBHOOK_MUESTRAS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadEnvio)
        });

        if (respuesta.ok) {
            alert("¡Solicitud registrada en el servidor! Procesaremos tu muestra física.");
            cerrarModalMuestra();
            document.getElementById("formMuestra").reset();
        } else {
            alert("Error al registrar los datos. Intenta nuevamente.");
        }
    } catch (error) {
        console.error("Fallo de conexión con n8n:", error);
        alert("No se pudo conectar con el servidor local de automatización.");
    }
});

// 6. Generador de Arte en Vivo con IA
async function generarDisenoIA() {
    const promptTexto = document.getElementById("promptIA").value.trim();
    const btnGenerar = document.getElementById("btnGenerarIA");
    const previewImg = document.getElementById("previewRender");

    if (!promptTexto) {
        alert("Escribe una descripción para que la IA genere el arte.");
        return;
    }

    btnGenerar.disabled = true;
    btnGenerar.innerText = "Renderizando... ⏳";
    previewImg.style.opacity = "0.3";

    try {
        const promptEncode = encodeURIComponent(promptTexto);
        const urlImagenGenerada = `https://pollinations.ai/p/${promptEncode}?width=512&height=512&seed=${Math.floor(Math.random() * 1000)}&nologo=true`;

        const imgTemp = new Image();
        imgTemp.src = urlImagenGenerada;
        
        imgTemp.onload = () => {
            previewImg.src = urlImagenGenerada;
            previewImg.style.opacity = "1";
            imagenDisenoActual = urlImagenGenerada;

            btnGenerar.disabled = false;
            btnGenerar.innerText = "Generar Arte ✨";
        };

        imgTemp.onerror = () => { throw new Error("Fallo al cargar la imagen generada."); };

    } catch (error) {
        console.error("Error en IA:", error);
        alert("No se pudo generar la imagen. Inténtalo de nuevo.");
        btnGenerar.disabled = false;
        btnGenerar.innerText = "Generar Arte ✨";
        previewImg.style.opacity = "1";
    }
}