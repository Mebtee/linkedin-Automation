export type NavigationItem = {
  href: string;
  label: string;
};

export const app = {
  id: "linkedin-recruiter-content",
  name: "LinkedIn Recruiter Content",
  version: "5.1.0",
  description:
    "An AI-powered LinkedIn content automation system that turns your learning journal and course materials into recruiter-focused content opportunities.",
  navigation: [
    { href: "/opportunities", label: "Opportunities" },
    { href: "/journal", label: "Journal" },
    { href: "/course-materials", label: "Materials" },
    { href: "/posts", label: "Posts" },
    { href: "/schedule", label: "Schedule" },
    { href: "/settings", label: "Settings" },
  ] satisfies NavigationItem[],
} as const;
