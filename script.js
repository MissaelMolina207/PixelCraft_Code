// Reemplaza con tu número real de WhatsApp (con código de país, ej. 521XXXXXXXXXX)
const TELEFONO_WHATSAPP = "5210000000000";

function enviarWhatsAppGeneral() {
    const mensaje = encodeURIComponent("¡Hola Serigraph Online! Quisiera más información sobre sus servicios de serigrafía e impresión 3D.");
    window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${mensaje}`, '_blank');
}

function cotizarProducto(nombreProducto, precio) {
    const mensaje = encodeURIComponent(`¡Hola! Me interesa cotizar el siguiente producto:\n- *Producto:* ${nombreProducto}\n- *Precio estimado:* $${precio} MXN\n\n¿Cuáles son los pasos para personalizar mi pedido?`);
    window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${mensaje}`, '_blank');
}