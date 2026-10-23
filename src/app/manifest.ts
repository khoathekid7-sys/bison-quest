import type { MetadataRoute } from "next";
import { asset, BASE_PATH } from "@/lib/site";

export const dynamic = "force-static";

/** Web app manifest: lets players add Bison Quest to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE_PATH}/`,
    name: "Bison Quest",
    short_name: "Bison Quest",
    description: "A photo scavenger hunt across Bucknell University. Find the campus hiding in plain sight.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b2545",
    theme_color: "#0b2545",
    categories: ["games", "education", "travel"],
    icons: [
      { src: asset("icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: asset("icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
