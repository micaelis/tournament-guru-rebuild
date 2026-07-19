import type { Metadata } from "next";
import { LegalArticle } from "@/app/components/LegalArticle";

export const metadata: Metadata = { title: "Legal · Tournament Guru" };

/* Client-provided copy, rendered verbatim — do not edit the strings.
   The route stays /terms; the page labels itself "Legal" per the copy. */
export default function Page() {
  return (
    <LegalArticle
      eyebrow="Legal"
      title="Legal"
      intro={[
        "Welcome to TournamentGuru. This page outlines the legal terms, user responsibilities, and limitations that govern the use of our platform, products, and services. By accessing or using our platform, you agree to the following terms:",
      ]}
      sections={[
        {
          heading: "Age Restrictions",
          paragraphs: [
            "Our platform is intended for users who are 18 years of age or older. By using TournamentGuru, you confirm that you meet the minimum age requirement. We do not knowingly collect personal information from individuals under the age of 18.",
            "If we become aware that a user under 18 has provided us with personal information, we will take steps to delete such data.",
          ],
        },
        {
          heading: "User Responsibility",
          paragraphs: [
            "You are responsible for ensuring that any information you provide is accurate, up to date, and does not infringe on the rights of any third party. You agree not to use our platform for any unlawful or unauthorized purposes.",
          ],
        },
        {
          heading: "Prohibited Use",
          lead: "You may not:",
          bullets: [
            "Attempt to gain unauthorized access to our platform or servers",
            "Use bots, crawlers, or other automated systems without permission",
            "Upload harmful or offensive content",
            "Misrepresent yourself or impersonate another person or entity",
            "Violate any applicable laws or regulations",
          ],
        },
      ]}
    />
  );
}
