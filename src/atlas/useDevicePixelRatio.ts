import { useEffect, useState } from "react";
export function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const changed = () => setDpr(window.devicePixelRatio || 1);
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    query.addEventListener("change", changed);
    window.addEventListener("resize", changed);
    return () => {
      query.removeEventListener("change", changed);
      window.removeEventListener("resize", changed);
    };
  }, [dpr]);
  return dpr;
}
