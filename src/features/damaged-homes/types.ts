// CHG-162 — «Mi casita partida»: informe ciudadano de un hogar en muy
// malas condiciones. Espejo de `DamagedHomeReportInput` y
// `DamagedHomeReportReceipt` del contrato; anónimo permitido, sale en
// el mapa con la categoría `damaged_home`.

export const MIN_DAMAGE_DESCRIPTION_LENGTH = 10;
export const MAX_DAMAGE_DESCRIPTION_LENGTH = 1000;
export const MIN_HOME_ADDRESS_LENGTH = 3;
export const MAX_HOME_ADDRESS_LENGTH = 300;
export const MAX_HOME_CITY_LENGTH = 100;

export interface DamagedHomeDraft {
  description: string;
  municipality: string;
  department: string;
  address: string;
  latitude: string;
  longitude: string;
  truthConfirmed: boolean;
}

export interface DamagedHomeReceipt {
  id: string;
  createdAt: string;
}
