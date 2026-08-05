import type { MetadataRoute } from "next";

// Web app manifest: name/theme/icon metadata for the browser.
// `display: "browser"` is deliberate — the iPad must run the POS INSIDE Bluefy
// for Web Bluetooth (BLE printing). An installed standalone PWA runs in WebKit
// and loses navigator.bluetooth, so we don't advertise a standalone install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caffeine Cravers POS",
    short_name: "Cravers POS",
    description: "Point-of-sale for the Caffeine Cravers coffee stall.",
    start_url: "/",
    display: "browser",
    background_color: "#17110e",
    theme_color: "#17110e",
    icons: [{ src: "/icon", sizes: "32x32", type: "image/png" }],
  };
}
