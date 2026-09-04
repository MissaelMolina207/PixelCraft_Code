// 1. Configuración de URLs y Variables
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/pedidos-serigraph";
const N8N_WEBHOOK_MUESTRAS = "http://localhost:5678/webhook-test/solicitud-muestra-serigraph";
const TELEFONO_WHATSAPP = "5214621954045";

// Variable global para almacenar el diseño activo (URL)
let imagenDisenoActual = "https://miservidor.com/mockups/funda-sol-default.png";

// 2. Atención general por WhatsApp
function enviarWhatsAppGeneral() {
    const mensaje = encodeURIComponent("¡Hola Serigraph Online! Quisiera más información sobre sus servicios de serigrafía e impresión 3D.");
    window.open(`whatsapp://send?phone=${TELEFONO_WHATSAPP}&text=${mensaje}`, '_self');
}

// 3. Cotización directa de productos del catálogo
function cotizarProducto(nombreProducto, precio) {
    const datosPedido = {
        producto: nombreProducto,
        precioEstimado: precio,
        fecha: new Date().toISOString()
    };

    // Envío en segundo plano a n8n sin bloquear la navegación
    const blob = new Blob([JSON.stringify(datosPedido)], { type: 'application/json' });
    navigator.sendBeacon(N8N_WEBHOOK_URL, blob);

    // Redirección a WhatsApp con mensaje preconfigurado
    const mensaje = encodeURIComponent(`¡Hola! Me interesa cotizar el siguiente producto:\n- *Producto:* ${nombreProducto}\n- *Precio estimado:* $${precio} MXN\n\n¿Cuáles son los pasos para personalizar mi pedido?`);
    window.open(`whatsapp://send?phone=${TELEFONO_WHATSAPP}&text=${mensaje}`, '_self');
}

// 4. Gestión del Modal de Muestras
function abrirModalMuestra(urlImagen = null) {
    if (urlImagen) {
        imagenDisenoActual = urlImagen;
    }
    document.getElementById("modalMuestra").style.display = "flex";
}

function cerrarModalMuestra() {
    document.getElementById("modalMuestra").style.display = "none";
}

// 5. Escuchador del Formulario de Muestra Física
document.getElementById("formMuestra").addEventListener("submit", async function(event) {
    event.preventDefault();

    // Estructuración del domicilio
    const direccionEstructurada = `${document.getElementById("calleNumero").value.trim()}, Col. ${document.getElementById("colonia").value.trim()}, C.P. ${document.getElementById("codigoPostal").value.trim()}, ${document.getElementById("ciudadEstado").value.trim()}`;

    // Construcción de la carga útil (Payload)
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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payloadEnvio)
        });

        if (respuesta.ok) {
            alert("¡Solicitud recibida con éxito! En breve procesaremos tu pedido.");
            cerrarModalMuestra();
            document.getElementById("formMuestra").reset();
        } else {
            alert("Ocurrió un detalle al procesar la solicitud. Intenta de nuevo.");
        }
    } catch (error) {
        console.error("Error al conectar con n8n:", error);
        alert("No se pudo conectar con el servidor de registros.");
    }
});

// 6. Generador de Arte con IA y actualización de Render
async function generarDisenoIA() {
    const promptTexto = document.getElementById("promptIA").value.trim();
    const btnGenerar = document.getElementById("btnGenerarIA");
    const previewImg = document.getElementById("previewRender");

    if (!promptTexto) {
        alert("Por favor escribe una descripción para tu diseño.");
        return;
    }

    btnGenerar.disabled = true;
    btnGenerar.innerText = "Creando magia... ⏳";
    previewImg.style.opacity = "0.4";

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

        imgTemp.onerror = () => {
            throw new Error("No se pudo cargar la imagen generada.");
        };

    } catch (error) {
        console.error("Error al generar imagen con IA:", error);
        alert("Hubo un fallo al generar la imagen. Inténtalo nuevamente.");
        btnGenerar.disabled = false;
        btnGenerar.innerText = "Generar Arte ✨";
        previewImg.style.opacity = "1";
    }
}