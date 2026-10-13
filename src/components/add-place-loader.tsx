"use client";

import dynamic from "next/dynamic";

/** AddPlace reads sessionStorage on first render, so it runs client-only. */
export const AddPlaceLoader = dynamic(
  () => import("./add-place").then((m) => m.AddPlace),
  { ssr: false },
);
