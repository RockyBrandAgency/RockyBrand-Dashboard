// El teléfono del huésped vive bajo dos claves distintas según quién lo
// escribió, y el panel venía leyendo solo una de las dos.
//
//   Contact.WhatsApp  lo que declara pms_models.py al validar un huésped
//   Contact.Phone     lo que ESCRIBE de verdad el formulario de reservas
//                     de Chile Fly Fishing (cff_booking_lambda.py, en el
//                     bloque que arma GuestProfile.from_payload)
//
// El backend proyecta el dict `Contact` completo, así que el número siempre
// llegó al navegador: la ficha lo pedía por `WhatsApp` y por eso mostraba "—"
// aunque el pescador hubiera dejado su teléfono. Pasó con la reserva de
// Daniel Cormier del 2026-08-16, la primera reserva real del motor.
//
// El arreglo va acá y no repetido en cada pantalla para que la próxima ficha
// que muestre un contacto no vuelva a elegir mal la clave.

export type ContactoHuesped = {
  Email?: string;
  WhatsApp?: string;
  Phone?: string;
};

/** El número del huésped, venga por la clave que venga. '' si no dejó ninguno. */
export function telefonoDe(contacto?: ContactoHuesped | null): string {
  if (!contacto) return '';
  return (contacto.WhatsApp || contacto.Phone || '').trim();
}

/**
 * Enlace wa.me para abrir la conversación. Devuelve null si el número no
 * sirve para eso.
 *
 * wa.me exige solo dígitos, con código de país y sin '+'. Los números llegan
 * como los tipeó el pescador ("+1 5149093748"), así que se normalizan acá.
 * Un número sin código de país es indistinguible de uno con él, así que se
 * exige un largo mínimo de 8 dígitos antes de ofrecer el enlace: es preferible
 * mostrar el número sin link a mandar a Mato a un chat con un desconocido.
 */
export function enlaceWhatsapp(contacto?: ContactoHuesped | null): string | null {
  const digitos = telefonoDe(contacto).replace(/\D/g, '');
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}`;
}
