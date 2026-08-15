import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PressableStateCallbackType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FadeInImage,
  RevealGroupContainer,
} from "../../components/FadeInImage";
import cusolLogo from "../../assets/cusol-uis-logo-enhanced.png";
import prometeoLogo from "../../assets/prometeo-logo-hd.png";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";

export const CUSOL_UIS_NEWS_URL =
  "https://comunicaciones.uis.edu.co/flisol-2026-santander-software-libre-inteligencia-artificial/";
export const CUSOL_COMMUNITY_PROFILE_URL =
  "https://www.python.org.co/usuarios/cusol-uis/";
export const PROMETEO_UIS_URL =
  "https://investigacion.uis.edu.co/grupos-de-investigacion/grupo-de-investigacion-prometeo/index.html";

const prometeoLines = [
  "Infancia, Mujer y Familia",
  "Construcción Disciplinar en Trabajo Social",
  "Géneros: feminidades, masculinidades y LGBTI",
  "Interculturalidades",
  "Paz, Conflictos y Democracia",
  "Responsabilidad Social Empresarial",
];

const prometeoServices = [
  "Acompañamiento técnico a políticas públicas",
  "Formación en competencias investigativas",
  "Diplomados y talleres",
  "Caracterizaciones socioeconómicas",
  "Análisis de datos para investigación social",
];

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const stacked = width < 1040;

  return (
    <LinearGradient
      colors={["#060912", colors.canvas, "#07101a"]}
      locations={[0, 0.54, 1]}
      style={styles.root}
    >
      <View style={styles.ambientLayer} pointerEvents="none">
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />
      </View>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la portada"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>VOLVER A LA PLATAFORMA</Text>
          </Pressable>
          <View style={styles.verificationBadge}>
            <View style={styles.verificationDot} />
            <Text style={styles.verificationText}>FUENTES VERIFICADAS · 14 AGO 2026</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, stacked && styles.heroStacked]}>
            <View style={styles.heroIdentity}>
              <LinearGradient
                colors={["rgba(226,240,250,0.68)", "rgba(55,72,91,0.5)", "rgba(194,214,228,0.58)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.identityPlate}
              >
                {/* CHG-070: los círculos entran junto con los logos. */}
                <RevealGroupContainer group="about-brand-logos" slideFrom="left" style={styles.identitySurface}>
                  <FadeInImage accessibilityLabel="Logo de CUSOL UIS" group="about-brand-logos" revealMode="signal" resizeMode="contain" source={cusolLogo} style={styles.heroLogo} />
                  <View style={styles.prometeoCircle}>
                    <FadeInImage accessibilityLabel="Logo de Prometeo UIS" group="about-brand-logos" revealMode="signal" resizeMode="contain" source={prometeoLogo} style={styles.prometeoLogo} />
                  </View>
                </RevealGroupContainer>
              </LinearGradient>
              <Text style={styles.identityTitle}>CUSOL DISASTER PLATFORM</Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>IDENTIDAD / UNIVERSIDAD INDUSTRIAL DE SANTANDER</Text>
              <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                Tecnología abierta.{"\n"}
                <Text style={styles.titleAccent}>Investigación con sentido humano.</Text>
              </Text>
              <Text style={styles.lead}>
                Esta plataforma reúne dos tradiciones de la UIS: la cultura de conocimiento
                abierto promovida por CUSOL y la investigación social orientada a comprender
                y transformar realidades complejas desarrollada por Prometeo.
              </Text>
              <View style={styles.heroTags}>
                <InfoTag label="SOFTWARE LIBRE" />
                <InfoTag label="CIENCIAS HUMANAS" />
                <InfoTag label="RESPUESTA RESPONSABLE" active />
              </View>
            </View>
          </View>

          <View style={[styles.organizations, stacked && styles.organizationsStacked]}>
            <OrganizationPanel
              accent={colors.cyan}
              code="COMUNIDAD / TECNOLOGÍA ABIERTA"
              title="CUSOL-UIS"
              subtitle="Comunidad Universitaria de Software Libre"
            >
              <Text style={styles.bodyText}>
                Nació alrededor de 2005 por iniciativa de estudiantes de la Universidad
                Industrial de Santander interesados en el uso, la filosofía y las libertades
                asociadas al software libre.
              </Text>
              <Fact title="Su propósito">
                Promover y difundir el Software Libre y la Cultura Libre mediante actividades
                académicas, educativas y de integración dentro y fuera de la UIS.
              </Fact>
              <Fact title="Conocimiento compartido">
                Crea espacios para aprender herramientas libres, socializar experiencias y
                debatir sus implicaciones educativas, tecnológicas y sociales.
              </Fact>
              <Fact title="Comunidad activa">
                En 2026 CUSOL-UIS participa en la organización de FLISOL Santander, con una
                agenda sobre software libre, inteligencia artificial, educación,
                ciberseguridad y desarrollo de software.
              </Fact>
            </OrganizationPanel>

            <OrganizationPanel
              accent={colors.alive}
              code="INVESTIGACIÓN / TRANSFORMACIÓN SOCIAL"
              title="PROMETEO"
              subtitle="Grupo de Investigación · Escuela de Trabajo Social"
            >
              <Text style={styles.bodyText}>
                La UIS presenta a Prometeo como el primer grupo interdisciplinario de su
                Facultad de Ciencias Humanas y el primer grupo de investigación de la Escuela
                de Trabajo Social.
              </Text>
              <Fact title="Una mirada situada">
                Investiga problemas sociales del contexto regional desde enfoques de género,
                diferencial y de derechos humanos, con respeto por el medio ambiente.
              </Fact>
              <Fact title="Extensión y capacidades">
                Ofrece acompañamiento técnico, formación investigativa, talleres,
                caracterizaciones socioeconómicas y análisis de datos para investigación social.
              </Fact>
              <Text style={styles.miniHeading}>LÍNEAS DE INVESTIGACIÓN</Text>
              <View style={styles.lineGrid}>
                {prometeoLines.map((line, index) => (
                  <View key={line} style={styles.lineItem}>
                    <Text style={styles.lineNumber}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={styles.lineText}>{line}</Text>
                  </View>
                ))}
              </View>
            </OrganizationPanel>
          </View>

          <LinearGradient
            colors={["rgba(81,229,255,0.11)", "rgba(67,231,173,0.07)", "rgba(135,150,255,0.09)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.convergence}
          >
            <View style={styles.convergenceCodeRow}>
              <Text style={styles.convergenceCode}>VISIÓN EDITORIAL DE ESTA PLATAFORMA</Text>
              <Text style={styles.convergenceMeta}>NO DECLARA UNA ALIANZA FORMAL</Text>
            </View>
            <Text style={styles.convergenceTitle} accessibilityRole="header">
              Abrir la tecnología. Humanizar los datos.
            </Text>
            <Text style={styles.convergenceText}>
              La propuesta de CUSOL Disaster Platform combina principios de apertura,
              trazabilidad y colaboración con una lectura responsable de las emergencias.
              La tecnología organiza información; las decisiones humanas conservan la
              responsabilidad, la verificación y el cuidado de las personas.
            </Text>
          </LinearGradient>

          <View style={styles.servicesSection}>
            <Text style={styles.eyebrow}>CAPACIDADES DOCUMENTADAS / PROMETEO</Text>
            <Text style={styles.sectionTitle} accessibilityRole="header">Investigación que llega al territorio</Text>
            <View style={styles.servicesGrid}>
              {prometeoServices.map((service, index) => (
                <View key={service} style={styles.serviceCard}>
                  <Text style={styles.serviceIndex}>0{index + 1}</Text>
                  <Text style={styles.serviceText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sourcesSection}>
            <View style={styles.sourcesHeading}>
              <View>
                <Text style={styles.eyebrow}>TRAZABILIDAD / LECTURAS DE REFERENCIA</Text>
                <Text style={styles.sectionTitle} accessibilityRole="header">Fuentes consultadas</Text>
              </View>
              <Text style={styles.sourcesDate}>VERIFICADAS · 14 AGO 2026</Text>
            </View>
            <View style={styles.sourcesGrid}>
              <SourceLink
                classification="FUENTE INSTITUCIONAL UIS"
                title="FLISOL 2026 Santander"
                description="Actividad reciente de CUSOL-UIS y enfoque de la agenda."
                url={CUSOL_UIS_NEWS_URL}
              />
              <SourceLink
                classification="FUENTE COMUNITARIA"
                title="Perfil de CUSOL-UIS"
                description="Historia, misión y visión declaradas por la comunidad."
                url={CUSOL_COMMUNITY_PROFILE_URL}
              />
              <SourceLink
                classification="FUENTE INSTITUCIONAL UIS"
                title="Grupo de Investigación Prometeo"
                description="Presentación, líneas, producción, servicios y contacto."
                url={PROMETEO_UIS_URL}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>CUSOL DISASTER PLATFORM · UIS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a la portada"
              onPress={onBack}
              style={({ pressed }) => [styles.footerBack, pressed && styles.pressed]}
            >
              <Text style={styles.footerBackText}>VOLVER A LA PLATAFORMA ↑</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function OrganizationPanel({
  accent,
  children,
  code,
  subtitle,
  title,
}: {
  accent: string;
  children: React.ReactNode;
  code: string;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.organizationPanel}>
      <View style={[styles.organizationAccent, { backgroundColor: accent }]} />
      <Text style={[styles.organizationCode, { color: accent }]}>{code}</Text>
      <Text style={styles.organizationTitle} accessibilityRole="header">{title}</Text>
      <Text style={styles.organizationSubtitle}>{subtitle}</Text>
      <View style={styles.organizationBody}>{children}</View>
    </View>
  );
}

function Fact({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factDot} />
      <View style={styles.factCopy}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factText}>{children}</Text>
      </View>
    </View>
  );
}

function InfoTag({ active = false, label }: { active?: boolean; label: string }) {
  return (
    <View style={[styles.infoTag, active && styles.infoTagActive]}>
      <Text style={[styles.infoTagText, active && styles.infoTagTextActive]}>{label}</Text>
    </View>
  );
}

function SourceLink({
  classification,
  description,
  title,
  url,
}: {
  classification: string;
  description: string;
  title: string;
  url: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, abrir fuente externa`}
      accessibilityHint="Abre la fuente original fuera de la plataforma"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => void Linking.openURL(url)}
      style={({
        hovered,
        pressed,
      }: PressableStateCallbackType & { hovered?: boolean }) => [
        styles.sourceCard,
        (focused || hovered) && styles.sourceCardInteractive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.sourceClassification}>{classification}</Text>
      <Text style={styles.sourceTitle}>{title}</Text>
      <Text style={styles.sourceDescription}>{description}</Text>
      <Text style={styles.sourceAction}>ABRIR FUENTE ↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  ambientLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  glow: { position: "absolute", borderRadius: 999 },
  glowTop: { width: 620, height: 620, top: -320, right: -240, backgroundColor: "rgba(81,229,255,0.055)" },
  glowBottom: { width: 680, height: 680, bottom: -360, left: -300, backgroundColor: "rgba(67,231,173,0.045)" },
  header: { width: "100%", maxWidth: contentMaxWidth, minHeight: 76, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerCompact: { minHeight: 68, paddingHorizontal: 12 },
  backButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, paddingRight: 12 },
  backArrow: { color: colors.cyan, fontSize: 24 },
  backText: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  verificationBadge: { flexDirection: "row", alignItems: "center", gap: 7 },
  verificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.alive },
  verificationText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.6 },
  scrollContent: { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", gap: 24, paddingHorizontal: 24, paddingTop: 54, paddingBottom: 30 },
  scrollContentCompact: { paddingHorizontal: 10, paddingTop: 34 },
  hero: { minHeight: 500, flexDirection: "row", alignItems: "center", gap: 72, paddingHorizontal: 28, paddingVertical: 46, borderLeftWidth: 1, borderLeftColor: "rgba(81,229,255,0.25)" },
  heroStacked: { minHeight: 0, flexDirection: "column", alignItems: "stretch", gap: 40, paddingHorizontal: 20 },
  heroIdentity: { flexShrink: 0, alignItems: "center" },
  identityPlate: { padding: 1, borderRadius: 22, shadowColor: colors.cyan, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  identitySurface: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 21, backgroundColor: "rgba(8,15,25,0.98)" },
  heroLogo: { width: 126, height: 126 },
  prometeoCircle: { width: 126, height: 126, overflow: "hidden", borderRadius: 63, backgroundColor: "#ffffff" },
  prometeoLogo: { width: "100%", height: "100%" },
  identityTitle: { marginTop: 12, color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 10, fontWeight: "900", letterSpacing: 2.8, textAlign: "center" },
  heroCopy: { minWidth: 0, flex: 1, gap: 14 },
  eyebrow: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 66, fontWeight: "800", letterSpacing: -4.2, lineHeight: 68 },
  titleCompact: { fontSize: 42, letterSpacing: -2.4, lineHeight: 46 },
  titleAccent: { color: colors.cyan },
  lead: { maxWidth: 760, color: colors.inkSoft, fontSize: 15, lineHeight: 25 },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
  infoTag: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 5 },
  infoTagActive: { borderColor: "rgba(67,231,173,0.28)", backgroundColor: "rgba(67,231,173,0.05)" },
  infoTagText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 },
  infoTagTextActive: { color: colors.alive },
  organizations: { flexDirection: "row", alignItems: "stretch", gap: 18 },
  organizationsStacked: { flexDirection: "column" },
  organizationPanel: { minWidth: 0, flex: 1, overflow: "hidden", padding: 28, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.panel },
  organizationAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  organizationCode: { fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  organizationTitle: { marginTop: 13, color: colors.ink, fontSize: 42, fontWeight: "800", letterSpacing: -2.2, lineHeight: 45 },
  organizationSubtitle: { marginTop: 4, color: colors.inkSoft, fontSize: 11, fontWeight: "700" },
  organizationBody: { gap: 16, marginTop: 22 },
  bodyText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  factDot: { width: 7, height: 7, marginTop: 5, borderRadius: 4, backgroundColor: colors.cyan },
  factCopy: { minWidth: 0, flex: 1, gap: 4 },
  factTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  factText: { color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  miniHeading: { marginTop: 3, color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  lineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  lineItem: { minWidth: 190, flexGrow: 1, flexBasis: "46%", flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: "rgba(5,9,17,0.48)" },
  lineNumber: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900" },
  lineText: { minWidth: 0, flex: 1, color: colors.inkSoft, fontSize: 8, lineHeight: 12 },
  convergence: { gap: 13, padding: 34, borderWidth: 1, borderColor: "rgba(81,229,255,0.20)", borderRadius: 16 },
  convergenceCodeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  convergenceCode: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  convergenceMeta: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.6 },
  convergenceTitle: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.5 },
  convergenceText: { maxWidth: 940, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  servicesSection: { gap: 14, paddingVertical: 24 },
  sectionTitle: { color: colors.ink, fontSize: 32, fontWeight: "800", letterSpacing: -1.4 },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  serviceCard: { minWidth: 210, flexGrow: 1, flexBasis: 0, gap: 16, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.panelSoft },
  serviceIndex: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900" },
  serviceText: { color: colors.ink, fontSize: 10, fontWeight: "700", lineHeight: 15 },
  sourcesSection: { gap: 17, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
  sourcesHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  sourcesDate: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 },
  sourcesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sourceCard: { minWidth: 260, flexGrow: 1, flexBasis: 0, gap: 8, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: "rgba(10,16,27,0.78)" },
  sourceCardInteractive: { borderColor: colors.lineStrong, backgroundColor: "rgba(81,229,255,0.06)" },
  sourceClassification: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  sourceTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  sourceDescription: { flexGrow: 1, color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  sourceAction: { marginTop: 6, color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  footer: { minHeight: 72, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: colors.line },
  footerText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 },
  footerBack: { paddingVertical: 12, paddingLeft: 12 },
  footerBackText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  pressed: { opacity: 0.68 },
});
