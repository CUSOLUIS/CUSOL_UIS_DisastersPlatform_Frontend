// CHG-182 — «Mi casita destruida»: una familia cuenta cómo quedó su
// casa y, si quiere, deja un medio para recibir ayuda directa. Espejo
// de `DamagedHomeReportInput`, `ActiveDamagedHome` y `MyDamagedHome`
// del contrato.
//
// Reemplaza a «Mi casita partida» (CHG-162): mismo punto en el mapa
// (categoría `damaged_home`), pero publicar exige cuenta y la
// publicación lleva cuántas personas viven, fotos y canal de ayuda.

export const MIN_DAMAGE_DESCRIPTION_LENGTH = 10;
export const MAX_DAMAGE_DESCRIPTION_LENGTH = 1000;
export const MIN_HOME_ADDRESS_LENGTH = 3;
export const MAX_HOME_ADDRESS_LENGTH = 300;
export const MAX_HOME_CITY_LENGTH = 100;
// CHG-182: cuántas personas viven en la casa.
export const MIN_HOUSEHOLD_SIZE = 1;
export const MAX_HOUSEHOLD_SIZE = 60;
export const MIN_DONATION_REFERENCE_LENGTH = 4;
export const MAX_DONATION_REFERENCE_LENGTH = 60;

// Catálogo cerrado del contrato: la plataforma no verifica el dato ni
// intermedia la transferencia, así que al menos acota qué se escribe.
export const DAMAGED_HOME_DONATION_CHANNELS = [
  "Nequi",
  "Daviplata",
  "Bancolombia",
  "Movii",
  "Otro",
] as const;

export type DamagedHomeDonationChannel =
  (typeof DAMAGED_HOME_DONATION_CHANNELS)[number];

// Qué escribir en la referencia según el canal (ayuda al que transfiere
// y al que la escribe).
export const donationReferenceHint: Record<
  DamagedHomeDonationChannel,
  string
> = {
  Nequi: "Número de celular asociado a Nequi",
  Daviplata: "Número de celular asociado a Daviplata",
  Bancolombia: "Número de cuenta (ahorros o corriente)",
  Movii: "Número de celular asociado a Movii",
  Otro: "Escribe a dónde transferir (cuenta, llave o enlace)",
};

// El aviso que acompaña SIEMPRE al medio de ayuda, en el formulario y
// en la ficha pública. Se dice una sola vez y se dice claro.
export const DONATION_DISCLAIMER =
  "La plataforma no verifica este dato ni intermedia las transferencias: confirma con la familia antes de enviar dinero.";

export interface DamagedHomeDraft {
  description: string;
  municipality: string;
  department: string;
  address: string;
  latitude: string;
  longitude: string;
  // CHG-182
  householdSize: string;
  donationChannel: DamagedHomeDonationChannel | null;
  donationReference: string;
  // CHG-201: enlace opcional a un vídeo de TikTok que muestre la casa.
  videoUrl: string;
  truthConfirmed: boolean;
}

// CHG-201 — DEC-201-01: solo TikTok, y solo https. La comprobación que
// manda es la del servidor; esta existe para avisar antes de enviar, en
// vez de dejar que el formulario muera con un 422.
const TIKTOK_HOSTS = [
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
];

export const VIDEO_URL_HINT =
  "Pega el enlace del vídeo de TikTok (opcional). Se abrirá en TikTok cuando alguien lo toque.";

/** `null` si el enlace sirve; si no, el motivo, en prosa. */
export function videoUrlIssue(value: string): string | null {
  const limpio = value.trim();
  if (limpio.length === 0) return null;
  if (limpio.length > 300) return "El enlace es demasiado largo.";
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return "Eso no parece un enlace. Copia la dirección del vídeo desde TikTok.";
  }
  if (url.protocol !== "https:") return "El enlace debe empezar por https://";
  if (url.username || url.password)
    return "El enlace no puede llevar usuario ni contraseña.";
  if (!TIKTOK_HOSTS.includes(url.hostname))
    return "Solo se aceptan enlaces de TikTok.";
  return null;
}

export interface DamagedHomeReceipt {
  id: string;
  publicCode?: string | null;
  createdAt: string;
}

// Casita publicada, tal como la ven el mapa y su ficha.
export interface ActiveDamagedHome {
  id: string;
  publicCode: string | null;
  description: string;
  department: string;
  municipality: string;
  address: string;
  // Null cuando la publicación llegó solo con dirección escrita; esas
  // casitas no se dibujan en el mapa.
  latitude: number | null;
  longitude: number | null;
  householdSize: number | null;
  donationChannel: DamagedHomeDonationChannel | null;
  donationReference: string | null;
  // CHG-201: vídeo de TikTok, si la familia lo dejó. Público como las
  // fotos: lo ve cualquiera que abra la ficha.
  videoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  // Rutas relativas de las fotografías públicas.
  photoUrls: string[];
  commentRatingAverage?: number | null;
  commentRatingCount?: number;
}

export interface DamagedHomePage {
  items: ActiveDamagedHome[];
  total: number;
  generatedAt: string;
}

// La misma casita vista por su dueña, en «Mi espacio».
export interface MyDamagedHome extends ActiveDamagedHome {
  published: boolean;
  unreadComments: number;
  commentsCount: number;
}

export interface MyDamagedHomesResponse {
  items: MyDamagedHome[];
  total: number;
  unreadTotal: number;
}

export interface DamagedHomesDataSource {
  transport: "api" | "demo";
  listActive(signal?: AbortSignal): Promise<DamagedHomePage>;
  listMine(signal?: AbortSignal): Promise<MyDamagedHomesResponse>;
  markCommentsSeen(homeId: string): Promise<void>;
  // CHG-202: eliminar la casita propia. El servidor responde igual ante
  // una ajena que ante una inexistente, así que aquí no hay nada que
  // decidir: se pide y se recarga.
  remove(homeId: string): Promise<void>;
}
