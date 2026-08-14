import { useRouter } from "expo-router";
import { AboutPage } from "../features/about/AboutPage";

export default function AboutRoute() {
  const router = useRouter();

  return <AboutPage onBack={() => router.replace("/")} />;
}
