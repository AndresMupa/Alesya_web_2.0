// Créditos de las fotos de producto con licencia libre (Wikimedia Commons). Seguro para cliente y servidor.
// Se buscan por la ruta de la imagen: cuando un producto pasa a una foto propia, su crédito deja de mostrarse solo.
// CC BY y CC BY-SA exigen nombrar al autor, enlazar la licencia y la fuente, y decir si la obra se modificó.
// Las versiones adaptadas de una foto CC BY-SA quedan bajo la misma licencia.

export type ImageCredit = {
  /** Autor tal como lo indica la página del archivo. */
  author: string;
  /** Nombre corto de la licencia: "CC BY-SA 4.0", "CC0", "Dominio público". */
  license: string;
  licenseUrl: string | null;
  /** Página del archivo en Wikimedia Commons. */
  sourceUrl: string;
  /** Cambios hechos al original. */
  changes: string;
};

const cropped = "Recortada a formato cuadrado, redimensionada y convertida a WebP";
const padded = "Lienzo ampliado a formato cuadrado, redimensionada y convertida a WebP";
const blurred = "Lienzo ampliado a formato cuadrado con fondo desenfocado de la misma foto, redimensionada y convertida a WebP";
const bySa = (version: string) => ({ license: `CC BY-SA ${version}`, licenseUrl: `https://creativecommons.org/licenses/by-sa/${version}/` });

export const imageCredits: Record<string, ImageCredit> = {
  "/media/productos/commons-hc-sr04.webp": { author: "Suyash Dwivedi", ...bySa("4.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:HC_SR04_Ultrasonic_Module.jpg", changes: cropped },
  "/media/productos/commons-dht11.webp": { author: "Edwiyanto", ...bySa("4.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:Dht11.jpg", changes: padded },
  "/media/productos/commons-mpu-6050.webp": { author: "Nevit Dilmen", ...bySa("3.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:GY-521_MPU-6050_Module_3_Axis_Gyroscope_%2B_Accelerometer_0487.jpg", changes: blurred },
  "/media/productos/commons-rele-5v.webp": { author: "Suyash Dwivedi", ...bySa("4.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:SRD-05VDC-SL-C_5V_one-channel_relay_module.jpg", changes: cropped },
  "/media/productos/commons-protoboard-400.webp": { author: "oomlout", ...bySa("2.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:400_points_breadboard.jpg", changes: padded },
  "/media/productos/commons-arduino-uno.webp": { author: "Suyash Dwivedi", ...bySa("4.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:Arduino_Uno_R3_development_board_(1).jpg", changes: padded },
  "/media/productos/commons-rtc-ds3231.webp": { author: "Goga504", ...bySa("4.0"), sourceUrl: "https://commons.wikimedia.org/wiki/File:HW-084_front.jpg", changes: blurred },
};

export function imageCredit(src: string | null | undefined): ImageCredit | null {
  return src ? imageCredits[src.split("?")[0]] ?? null : null;
}
