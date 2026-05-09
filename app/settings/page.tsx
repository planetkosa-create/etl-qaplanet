import { PlaceholderPage } from "@/components/etl/PlaceholderPage";
import { placeholderPages } from "@/lib/etl/mock-data";

export default function SettingsPage() {
  return <PlaceholderPage {...placeholderPages["/settings"]} />;
}
