import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  type ImageProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FadeInImage } from "./FadeInImage";

// CHG-090 (QA): las fotografías públicas de los listados se descargaban
// todas al montar la lista, aunque la mayoría quedara fuera de la
// pantalla. Aquí la descarga se difiere hasta que el hueco de la imagen
// se acerca a la ventana; mientras tanto se pinta el marcador de
// posición que la tarjeta ya usaba cuando no hay foto.

// Margen de anticipación: la imagen empieza a bajar antes de entrar en
// pantalla para que el usuario no vea el hueco al desplazarse.
export const lazyImageRootMargin = "300px";

// Se detecta la capacidad, no la plataforma: en nativo no existe
// IntersectionObserver, así que el mismo chequeo cubre ambos mundos.
export function supportsViewportObserver(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.IntersectionObserver === "function"
  );
}

interface LazyImageProps extends ImageProps {
  containerStyle?: StyleProp<ViewStyle>;
  placeholder?: ReactNode;
}

export function LazyImage({
  containerStyle,
  placeholder = null,
  ...imageProps
}: LazyImageProps) {
  // Sin IntersectionObserver —nativo, o navegador que no lo trae— la
  // imagen se monta de una vez: diferir es una mejora, nunca un
  // requisito para que la foto aparezca.
  const [inViewport, setInViewport] = useState(
    () => !supportsViewportObserver(),
  );
  const hostRef = useRef<View>(null);

  useEffect(() => {
    if (inViewport) {
      return;
    }

    const node = hostRef.current as unknown as Element | null;
    if (!node) {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: lazyImageRootMargin },
    );

    try {
      observer.observe(node);
    } catch {
      // El nodo no es observable: la foto se muestra de una vez antes
      // que quedar esperando un aviso que nunca llegará.
      observer.disconnect();
      setInViewport(true);
      return;
    }

    return () => observer.disconnect();
  }, [inViewport]);

  return (
    <View ref={hostRef} style={containerStyle}>
      {inViewport ? <FadeInImage {...imageProps} /> : placeholder}
    </View>
  );
}
