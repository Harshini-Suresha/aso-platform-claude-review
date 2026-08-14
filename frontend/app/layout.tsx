import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import CustomShortcutManager from "@/components/CustomShortcutManager";

export const metadata: Metadata = {
  title: "RNA Therapeutics Platform",
  description: "ASO design platform — gene retrieval, mechanism selection, and candidate design.",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <CustomShortcutManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
