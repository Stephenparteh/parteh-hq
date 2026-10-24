import { useMemo, useRef } from "react";
import { useData } from "../context/Data.jsx";
import { createKit } from "./kit.js";

// A kit that always reads the newest projects, documents and settings.
export function useKit() {
  const { projects, docs, settings } = useData();
  const ref = useRef();
  ref.current = { projects, docs, settings };
  return useMemo(() => createKit(() => ref.current), []);
}
