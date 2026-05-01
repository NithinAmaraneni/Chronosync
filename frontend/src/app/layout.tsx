import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "ChronoSync — Smart Faculty-Student Timetable Access",
  description:
    "Streamlining academic schedules with smart faculty-student timetable access. Secure authentication for admins, faculty, and students.",
  keywords: ["timetable", "academic", "scheduling", "faculty", "student"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
