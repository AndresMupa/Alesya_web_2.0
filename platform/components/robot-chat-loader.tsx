"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const RobotChat = dynamic(() => import("@/components/robot-chat").then((module) => module.RobotChat), { ssr: false });

/**
 * El asistente Bambú se descarga cuando el navegador queda libre, no con la página: así no compite con el
 * contenido principal (título, video, productos) por la red ni por el hilo de la interfaz.
 */
export function RobotChatLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const start = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(start, 2000);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <RobotChat /> : null;
}
