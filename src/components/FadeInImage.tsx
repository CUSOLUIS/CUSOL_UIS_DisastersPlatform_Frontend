import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  type ImageProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

// CHG-063: imagen que permanece invisible mientras descarga y aparece
// con un fundido al terminar, en lugar de pintarse a pedazos. Con
// "reducir movimiento" activo aparece de una vez, pero igualmente solo
// cuando ya cargó completa.
// CHG-068: imágenes de un mismo `group` esperan a que TODAS carguen y
// aparecen a la vez, despacio y entrando desde el mismo lado.
// CHG-070: `RevealGroupContainer` desliza también el contenedor (los
// círculos de los logos) desde el principio: se registra como seguidor
// del grupo y anima cuando la última imagen termina de cargar; las
// imágenes en modo "signal" solo avisan su carga y dejan el movimiento
// completo al contenedor.

interface RevealGroup {
  members: Set<symbol>;
  loaded: Set<symbol>;
  started: boolean;
  starters: Map<symbol, () => void>;
}

const revealGroups = new Map<string, RevealGroup>();

function groupFor(name: string): RevealGroup {
  let group = revealGroups.get(name);
  if (!group) {
    group = {
      members: new Set(),
      loaded: new Set(),
      started: false,
      starters: new Map(),
    };
    revealGroups.set(name, group);
  }
  return group;
}

function leaveGroup(name: string, member: symbol) {
  const group = revealGroups.get(name);
  if (!group) return;
  group.members.delete(member);
  group.loaded.delete(member);
  group.starters.delete(member);
  if (group.members.size === 0) revealGroups.delete(name);
}

function markLoaded(name: string, member: symbol) {
  const group = groupFor(name);
  group.loaded.add(member);
  // El grupo arranca una única vez, cuando ya no falta ninguna; si una
  // imagen llega tarde (remontaje), se anima sola al cargar.
  if (group.started || group.loaded.size < group.members.size) {
    if (group.started) group.starters.get(member)?.();
    return;
  }
  group.started = true;
  group.starters.forEach((start) => start());
}

export const FADE_IN_IMAGE_DURATION_MS = 900;
const SLIDE_DISTANCE = 18;

interface FadeInImageProps extends ImageProps {
  // Nombre de grupo: todas las imágenes con el mismo nombre aparecen
  // sincronizadas cuando la última termina de cargar.
  group?: string;
  // Lado desde el que entra la imagen; el fundido puro no desliza.
  slideFrom?: "left" | "right";
  // "signal": la imagen solo avisa su carga al grupo y queda visible
  // de inmediato; el movimiento lo pone su RevealGroupContainer.
  revealMode?: "animate" | "signal";
}

export function FadeInImage({
  style,
  onLoad,
  group,
  slideFrom,
  revealMode = "animate",
  ...props
}: FadeInImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(
    new Animated.Value(
      slideFrom ? (slideFrom === "left" ? -SLIDE_DISTANCE : SLIDE_DISTANCE) : 0,
    ),
  ).current;
  const reducedMotion = useReducedMotion();
  const member = useMemo(() => Symbol("fade-in-image"), []);

  const startReveal = useRef(() => undefined as void);
  startReveal.current = () => {
    if (reducedMotion) {
      opacity.setValue(1);
      slide.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_IMAGE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: FADE_IN_IMAGE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (!group || revealMode === "signal") return;
    const joined = groupFor(group);
    joined.members.add(member);
    joined.starters.set(member, () => startReveal.current());
    return () => leaveGroup(group, member);
  }, [group, member, revealMode]);

  useEffect(() => {
    if (!group || revealMode !== "signal") return;
    const joined = groupFor(group);
    joined.members.add(member);
    return () => leaveGroup(group, member);
  }, [group, member, revealMode]);

  if (revealMode === "signal" && group) {
    // El contenedor del grupo es quien oculta y mueve; la imagen solo
    // reporta su carga.
    return (
      <Animated.Image
        {...props}
        style={style}
        onLoad={(event) => {
          markLoaded(group, member);
          onLoad?.(event);
        }}
      />
    );
  }

  return (
    <Animated.Image
      {...props}
      style={[style, { opacity, transform: [{ translateX: slide }] }]}
      onLoad={(event) => {
        if (group) {
          markLoaded(group, member);
        } else {
          startReveal.current();
        }
        onLoad?.(event);
      }}
    />
  );
}

// CHG-070: contenedor que entra en escena JUNTO con las imágenes del
// grupo — círculos, marcos y logos se desplazan como una sola pieza.
// Es un seguidor: no bloquea el arranque del grupo (no carga nada) y
// anima cuando la última imagen "signal" termina de cargar.
export function RevealGroupContainer({
  group,
  slideFrom = "left",
  style,
  children,
}: {
  group: string;
  slideFrom?: "left" | "right";
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(
    new Animated.Value(
      slideFrom === "left" ? -SLIDE_DISTANCE : SLIDE_DISTANCE,
    ),
  ).current;
  const reducedMotion = useReducedMotion();
  const follower = useMemo(() => Symbol("reveal-group-container"), []);

  const startReveal = useRef(() => undefined as void);
  startReveal.current = () => {
    if (reducedMotion) {
      opacity.setValue(1);
      slide.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_IMAGE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: FADE_IN_IMAGE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    const joined = groupFor(group);
    // Seguidor: recibe el arranque sin contar como imagen pendiente.
    joined.starters.set(follower, () => startReveal.current());
    if (joined.started) startReveal.current();
    return () => {
      const current = revealGroups.get(group);
      current?.starters.delete(follower);
    };
  }, [group, follower]);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateX: slide }] }]}
    >
      {children}
    </Animated.View>
  );
}
