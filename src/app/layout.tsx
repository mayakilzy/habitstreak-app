import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HabitStreak — Build Better Habits Daily",
  description: "Track daily habits, build streaks, and visualize your progress with a calendar heatmap.",
};

// Prevent flash of wrong theme
const themeScript = `(function(){try{var t=localStorage.getItem('habitstreak-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}