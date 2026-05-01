import { IngresosPage } from '@/components/pages/IngresosPage';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return <IngresosPage searchParams={sp} />;
}
