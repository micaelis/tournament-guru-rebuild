import type { Metadata } from "next";
import { LegalArticle } from "@/app/components/LegalArticle";

export const metadata: Metadata = { title: "Privacy Policy · Tournament Guru" };

/* Client-provided copy, rendered verbatim — do not edit the strings. */
export default function Page() {
  return (
    <LegalArticle
      eyebrow="Privacy"
      title="Privacy Policy"
      intro={[
        "This privacy policy will help you understand how TournamentGuru uses and protects the data you provide to us when you visit and use Website home URL.",
        "We reserve the right to change this policy at any given time, of which you will be promptly updated. If you want to make sure that you are up to date with the latest changes, we advise you to frequently visit this page.",
      ]}
      sections={[
        {
          heading: "What User Data We Collect",
          lead: "When you visit the website, we may collect the following data:",
          bullets: [
            "Your IP address.",
            "Your contact information and email address.",
            "Other information such as interests and preferences.",
            "Data profile regarding your online behavior on our website.",
          ],
        },
        {
          heading: "Why We Collect Your Data",
          lead: "We are collecting your data for several reasons:",
          bullets: [
            "To better understand your needs.",
            "To improve our services and products.",
            "To send you promotional emails containing the information we think you will find interesting.",
            "To contact you to fill out surveys and participate in other types of market research.",
            "To customize our website according to your online behavior and personal preferences.",
          ],
        },
        {
          heading: "Safeguarding and Securing the Data",
          paragraphs: [
            "TournamentGuru is committed to securing your data and keeping it confidential. TournamentGuru has done all in its power to prevent data theft, unauthorized access, and disclosure by implementing the latest technologies and software, which help us safeguard all the information we collect online.",
          ],
        },
      ]}
    />
  );
}
