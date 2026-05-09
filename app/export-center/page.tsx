import { PlaceholderPage } from "@/components/etl/PlaceholderPage";
import { placeholderPages } from "@/lib/etl/mock-data";

export default function ExportCenterPage() {
  return <PlaceholderPage {...placeholderPages["/export-center"]} />;
}
