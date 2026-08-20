// Normaliza nombres/apellidos a "Título Case" sin importar cómo se hayan escrito (TODO
// MAYUSCULAS, todo minúsculas, mezclado): cada palabra queda con su primera letra en
// mayúscula y el resto en minúscula. Respeta palabras compuestas con guion (ej.
// "josé-maría" -> "José-María") y espacios múltiples se colapsan a uno solo.
export function capitalizarNombre(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((palabra) =>
      palabra
        .split('-')
        .map((parte) => (parte ? parte.charAt(0).toLocaleUpperCase('es') + parte.slice(1).toLocaleLowerCase('es') : parte))
        .join('-'),
    )
    .join(' ');
}
