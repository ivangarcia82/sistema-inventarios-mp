// src/app/(app)/colectas/[id]/page.tsx
import { notFound } from "next/navigation";
import { getColecta } from "@/app/actions/colectas";
import { ColectaDetail } from "@/components/colectas/colecta-detail";

export default async function ColectaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getColecta(id);
  if (!res.success) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <ColectaDetail colecta={res.data as any} />
    </div>
  );
}
