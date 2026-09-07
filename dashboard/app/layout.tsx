import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overnight Edge",
  description:
    "Close-to-open overnight hold: does the effect survive at the individual-stock level after realistic costs?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
