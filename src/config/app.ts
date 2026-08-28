export type NavigationItem = {
  href: string;
  label: string;
};

export const app = {
  id: "105-day-learning-journey",
  name: "105-Day Learning Journey",
  version: "0.1.0",
  description:
    "A personal AI-powered LinkedIn content automation system tracking a 105-day full-stack learning journey.",
  navigation: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/curriculum", label: "Curriculum" },
    { href: "/journal", label: "Journal" },
    { href: "/course-materials", label: "Materials" },
    { href: "/opportunities", label: "Opportunities" },
    { href: "/posts", label: "Posts" },
    { href: "/schedule", label: "Schedule" },
    { href: "/settings", label: "Settings" },
  ] satisfies NavigationItem[],
} as const;
