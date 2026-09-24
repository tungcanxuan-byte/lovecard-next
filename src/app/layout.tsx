import type { Metadata } from "next";
import { SITE_URL } from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

// Intentionally bare: template pages ship LadiPage's own CSS, so no global styles or fonts here.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
