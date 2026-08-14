export interface SelectedPhoto {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
}

export interface PhotoValidationResult {
  photos: SelectedPhoto[];
  errors: string[];
}

export interface MissingPersonReportReceipt {
  publicCaseCode: string;
  status: "under_review";
  receivedAt: string;
}

export interface MissingPersonReportDraft {
  firstNames: string;
  lastNames: string;
  aliases: string;
  birthDate: string;
  approximateAge: string;
  genderIdentity: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  heightCm: string;
  build: string;
  skinTone: string;
  hairDescription: string;
  eyeDescription: string;
  distinctiveMarks: string;
  medicalInformation: string;
  lastSeenDate: string;
  lastSeenTime: string;
  department: string;
  municipality: string;
  lastSeenArea: string;
  lastSeenLatitude: string;
  lastSeenLongitude: string;
  clothingDescription: string;
  circumstances: string;
  additionalDescription: string;
  reporterName: string;
  reporterRelationship: string;
  reporterPhone: string;
  reporterEmail: string;
  officialReportNumber: string;
  truthConfirmed: boolean;
  photoAuthorizationConfirmed: boolean;
  reviewAcknowledged: boolean;
}
