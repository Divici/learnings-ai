import { GlassPanel } from "@/components/glass/GlassPanel";
import { CardEditorTable } from "@/components/learning/CardEditorTable";

export default function CardsPage() {
  return (
    <GlassPanel className="rounded-2xl h-full w-full p-6 overflow-y-auto">
      <h1 className="text-xl font-medium text-white/90 mb-4">Cards</h1>
      <CardEditorTable />
    </GlassPanel>
  );
}
